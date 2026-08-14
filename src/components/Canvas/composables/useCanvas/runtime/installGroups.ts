// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Groups 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message,Modal } from 'ant-design-vue';
import { h,nextTick } from 'vue';
import { resolveGenerationTaskWorkflowId,resolveImageAssetId,toVideoApiClarity } from '../../../constants';
import { buildImageGenerationParams,buildTextGenerationParams,persistNodeGenerationSnapshot } from '../../../generationParams';
import { applyGenerationResultToNode,bindGenerationTaskId,followTextGenerationTaskOnNode,followVideoGenerationTaskOnNode,markGenerationNodeFailed,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,readGenerationResultIndex,resolveGenerationResultPreview,runImageGenerationOnNode,updateGenerationNodeProgress,type GenerationTaskDetail } from '../../../generationTask';
import { buildGroupExecuteConfirmContent,coalesceSharedGenerationTasks,collectGroupAiTasks,estimateGroupExecuteCredits,findGroupOutgoingAiResultNode,resolveGroupAiReferenceContext,sortGroupAiTasksByDependency,type GroupAiReferenceContext,type GroupAiTask,} from '../../../groupExecute';
import { toVideoApiPrompt } from '../../../promptMention';
import { createSkillId,listSavedCanvasSkills,mergeCanvasSkill,saveCanvasSkill,type SavedCanvasSkill,} from '../../../skillStorage';
import type { CanvasNodeData,GroupLayoutDirection } from '.././sharedImports';
import { api,applyGroupSelectionBoxResize,applyVideoFirstLastFrameParameters,buildGroupSkillMarkdown,cancelActiveRubberband,clientPointToGraphLocal,extractGroupSubgraph,fitStoredGroupSelectionBoxToMembers,getGroupBoxNodeIds,getGroupGraphBBox,getGroupScreenBox,getNodesInGroup,getScroller,getStoredGroupSelectionBox,IMG2PROMPT_DEFAULT_INSTRUCTION,layoutNodesInGroup,mergeStoryboardGroup,prepareImageNodeForInPlaceGeneration,reconcileGroupMembershipAfterNodeMove,resetVideoGenerationNodeForRetry,resizeGroupGraphBox,resolveGroupGraphBBox,setGroupTitle,setStoredGroupSelectionBox,syncTextNodeImageSource,tryAdoptNodeIntoIntersectingGroup,type GroupResizeHandle } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installGroups(ctx: CoreRuntimeContext) {
  ctx.handleGroupLayout = function handleGroupLayout(direction: GroupLayoutDirection = 'horizontal') {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group)
          return;
      const nodes = group.nodeIds
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => cell != null && cell.isNode());
      layoutNodesInGroup(nodes, direction);
      fitStoredGroupSelectionBoxToMembers(g, group.groupId);
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleGroupExecute = function handleGroupExecute() {
      const g = ctx.graph.value;
      const group = ctx.overlayGroupSelection.value;
      if (!g || !group || ctx.groupExecuting)
          return;
      const tasks = coalesceSharedGenerationTasks(g, sortGroupAiTasksByDependency(collectGroupAiTasks(g, group.groupId)));
      const credits = estimateGroupExecuteCredits(tasks);
      const content = buildGroupExecuteConfirmContent(tasks.length, credits);
      Modal.confirm({
          title: '整组执行',
          okText: '开始执行',
          cancelText: '取消',
          centered: true,
          content: h('div', [
              h('p', { style: { margin: '0 0 8px', lineHeight: '1.6', color: '#111827' } }, content.main),
              h('p', { style: { margin: 0, color: '#9ca3af', fontSize: '13px', lineHeight: '1.5' } }, content.hint),
          ]),
          onOk: () => {
              if (!tasks.length)
                  return;
              void (async () => {
                  ctx.groupExecuting = true;
                  try {
                      await ctx.runGroupAiGenerationPipeline(g, group.groupId, tasks);
                      message.success('整组执行已完成');
                  }
                  catch {
                      message.error('整组执行未完成，请检查节点状态后重试');
                  }
                  finally {
                      ctx.groupExecuting = false;
                      ctx.bumpToolbarRevision();
                      ctx.updateNodeToolbar();
                  }
              })();
          },
      });
  };
  
  ctx.groupExecuting = false;
  
  ctx.syncGroupAiProvenance = async function syncGroupAiProvenance(node: Node, refCtx: GroupAiReferenceContext) {
      const data = node.getData() as CanvasNodeData;
      ctx.applyImageDialogueProvenance(node, {
          prompt: refCtx.prompt,
          settings: refCtx.settings,
          sourceRefs: refCtx.sourceRefs,
          elementMarks: data.elementMarks,
          generationParams: buildImageGenerationParams({
              prompt: refCtx.prompt,
              capabilityCode: refCtx.capabilityCode,
              parameters: refCtx.parameters,
              workflowId: refCtx.workflowId ?? undefined,
              referenceAssetIds: refCtx.referenceAssetIds,
          }),
      });
  };
  
  ctx.executeGroupAiImageTask = async function executeGroupAiImageTask(node: Node, refCtx: GroupAiReferenceContext, options?: {
      sharedSiblingNodes?: Node[];
  }): Promise<boolean> {
      const data = node.getData() as CanvasNodeData;
      const title = refCtx.taskTitle || data.title || '生成';
      const fileName = data.fileName || `${title}.png`;
      const prompt = refCtx.prompt;
      const siblingNodes = (options?.sharedSiblingNodes ?? []).filter((item) => item.id !== node.id);
      const sharedMembers = [
          {
              node,
              resultIndex: readGenerationResultIndex(data),
              title,
              fileName,
          },
          ...siblingNodes.map((sibling) => {
              const siblingData = sibling.getData() as CanvasNodeData;
              const siblingTitle = refCtx.taskTitle || siblingData.title || title;
              return {
                  node: sibling,
                  resultIndex: readGenerationResultIndex(siblingData),
                  title: siblingTitle,
                  fileName: siblingData.fileName || `${siblingTitle}.png`,
              };
          }),
      ];
      for (const member of sharedMembers) {
          prepareImageNodeForInPlaceGeneration(member.node, {
              title: member.title,
              fileName: member.fileName,
              prompt,
          });
      }
      const outcome = await runImageGenerationOnNode(node, {
          title,
          fileName,
          createTask: async () => {
              const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `group-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const created = await api.createGenerationTask<GenerationTaskDetail>({
                  taskType: 'IMAGE',
                  capabilityCode: refCtx.capabilityCode,
                  prompt,
                  parameters: refCtx.parameters,
                  projectId: ctx.activeProjectId.value,
                  nodeId: node.id,
                  referenceAssetIds: refCtx.referenceAssetIds.length ? refCtx.referenceAssetIds : undefined,
                  workflowId: resolveGenerationTaskWorkflowId(refCtx.workflowId),
              }, idempotencyKey);
              ctx.userInfoStore.queryPointAccount();
              return created;
          },
          onTaskBound: (taskId) => {
              // 共享节点一并绑定同一 taskId，便于进度与结果对齐
              for (const member of sharedMembers) {
                  bindGenerationTaskId(member.node, taskId, 'IMAGE', member.resultIndex);
              }
              ctx.persistGenerationTaskBinding(node, { detail: prompt || title, taskType: title });
          },
          onProgress: (progress) => {
              if (sharedMembers.length <= 1)
                  return;
              for (const member of sharedMembers) {
                  if (member.node.id === node.id)
                      continue;
                  updateGenerationNodeProgress(member.node, progress);
              }
          },
          onError: (reason) => message.error(reason),
      });
      if (!outcome.success) {
          for (const member of sharedMembers) {
              if (member.node.id === node.id)
                  continue;
              if ((member.node.getData() as CanvasNodeData).imageGenState === 'loading') {
                  markGenerationNodeFailed(member.node);
              }
          }
          return false;
      }
      const allResults = outcome.allResults ?? [];
      const newTaskId = String((node.getData() as CanvasNodeData).generationTaskId ?? '').trim();
      // 按 generationResultIndex 把同一任务的 results 写回各个共享节点
      for (const member of sharedMembers) {
          const raw = allResults[member.resultIndex] ??
              (member.node.id === node.id ? allResults[0] : undefined);
          if (!raw) {
              if (member.node.id !== node.id) {
                  markGenerationNodeFailed(member.node, '未返回对应结果图片');
              }
              continue;
          }
          const resolved = await resolveGenerationResultPreview(raw);
          if (!resolved?.previewUrl?.trim()) {
              if (member.node.id !== node.id) {
                  markGenerationNodeFailed(member.node, '未返回对应结果图片');
              }
              continue;
          }
          await applyGenerationResultToNode(member.node, resolved, {
              title: member.title,
              fileName: member.fileName,
          });
          if (newTaskId) {
              bindGenerationTaskId(member.node, newTaskId, 'IMAGE', member.resultIndex);
          }
      }
      return true;
  };
  
  ctx.executeGroupAiTextImg2PromptTask = async function executeGroupAiTextImg2PromptTask(g: Graph, node: Node, refCtx?: GroupAiReferenceContext): Promise<boolean> {
      const synced = syncTextNodeImageSource(g, node);
      const liveIds = ctx.resolvePromptReferenceAssetIds(synced);
      const referenceAssetIds = refCtx?.referenceAssetIds?.length
          ? refCtx.referenceAssetIds
          : liveIds.length
              ? liveIds
              : [];
      const assetId = referenceAssetIds[0] ||
          (typeof refCtx?.parameters.assetId === 'string' ? refCtx.parameters.assetId : '') ||
          resolveImageAssetId(synced) ||
          '';
      if (!assetId) {
          message.warning('请先连接或上传参考图片');
          return false;
      }
      const prompt = refCtx?.prompt?.trim() || synced.genPrompt?.trim() || IMG2PROMPT_DEFAULT_INSTRUCTION;
      const nextData = {
          ...(node.getData() as CanvasNodeData),
          mode: 'editor' as const,
          title: '反推提示词',
          textPickerTask: 'img2prompt' as const,
          textGenState: 'loading' as const,
          textGenProgress: 0,
          content: '',
          generationFailMessage: undefined,
      };
      delete nextData.generationTaskId;
      delete nextData.generationTaskType;
      node.setData(nextData, { overwrite: true });
      persistNodeGenerationSnapshot(node, {
          ...buildTextGenerationParams({
              prompt,
              capabilityCode: 'IMAGE_PROMPT_REVERSE',
              parameters: { assetId, prompt },
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : [assetId],
          }),
          imageSourceRefs: refCtx?.sourceRefs?.length
              ? refCtx.sourceRefs
              : synced.imageSourceRefs,
          genPrompt: prompt,
      });
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `group-img2prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'TEXT',
              capabilityCode: 'IMAGE_PROMPT_REVERSE',
              prompt: '',
              parameters: { assetId, prompt },
              projectId: ctx.activeProjectId.value,
              nodeId: node.id,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : [assetId],
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId)
              throw new Error('创建反推提示词任务失败');
          ctx.userInfoStore.queryPointAccount();
          bindGenerationTaskId(node, taskId, 'TEXT');
          ctx.persistGenerationTaskBinding(node, { detail: prompt, taskType: '反推提示词' });
          const succeeded = await followTextGenerationTaskOnNode(node, taskId, {
              toHtml: ctx.plainTextToEditorHtml,
              onError: (reason) => message.error(reason),
          });
          if (!succeeded)
              return false;
          node.setData({ ...(node.getData() as CanvasNodeData), genPrompt: prompt }, { overwrite: true });
          ctx.persistGenerationTaskBinding(node, { detail: prompt, taskType: '反推提示词' });
          return true;
      }
      catch (error) {
          markTextGenerationNodeFailed(node);
          message.error(isRequestError(error) ? error.message : '反推提示词失败，请稍后重试');
          return false;
      }
  };
  
  ctx.executeGroupAiTextCopyTask = async function executeGroupAiTextCopyTask(node: Node): Promise<boolean> {
      const data = node.getData() as CanvasNodeData;
      const trimmedPrompt = data.genPrompt?.trim() || '';
      if (!trimmedPrompt)
          return false;
      node.setData({
          ...data,
          mode: 'editor',
          textGenState: 'loading',
          textGenProgress: 0,
          promptBarPinned: true,
          textPickerTask: '',
      }, { overwrite: true });
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `group-text-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'TEXT',
              capabilityCode: 'TEXT_COPY_V1',
              prompt: trimmedPrompt,
              parameters: { style: 'creative' },
              projectId: ctx.activeProjectId.value,
              nodeId: node.id,
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId)
              throw new Error('创建文案生成任务失败');
          ctx.userInfoStore.queryPointAccount();
          bindGenerationTaskId(node, taskId, 'TEXT');
          ctx.persistGenerationTaskBinding(node, { detail: trimmedPrompt, taskType: '自由创作' });
          return followTextGenerationTaskOnNode(node, taskId, {
              toHtml: ctx.plainTextToEditorHtml,
              onError: (reason) => message.error(reason),
          });
      }
      catch (error) {
          markTextGenerationNodeFailed(node);
          message.error(isRequestError(error) ? error.message : '文本生成失败，请稍后重试');
          return false;
      }
  };
  
  ctx.executeGroupAiVideoTask = async function executeGroupAiVideoTask(node: Node, refCtx: GroupAiReferenceContext): Promise<boolean> {
      const data = node.getData() as CanvasNodeData;
      const prompt = refCtx.prompt;
      if (!prompt)
          return false;
      resetVideoGenerationNodeForRetry(node, {
          title: refCtx.taskTitle,
          fileName: data.fileName || `${refCtx.taskTitle}.mp4`,
          prompt,
      });
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `group-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
          const videoParameters = applyVideoFirstLastFrameParameters({
              ...refCtx.parameters,
              clarity: toVideoApiClarity(String(refCtx.parameters.clarity ?? '720P')),
          }, String(refCtx.parameters.mode ?? ''), refCtx.referenceAssetIds);
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'VIDEO',
              capabilityCode: refCtx.capabilityCode,
              prompt: toVideoApiPrompt(prompt),
              parameters: videoParameters,
              projectId: ctx.activeProjectId.value,
              nodeId: node.id,
              referenceAssetIds: refCtx.referenceAssetIds.length ? refCtx.referenceAssetIds : undefined,
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId)
              throw new Error('创建视频生成任务失败');
          ctx.userInfoStore.queryPointAccount();
          bindGenerationTaskId(node, taskId, 'VIDEO');
          ctx.persistGenerationTaskBinding(node, { detail: prompt, taskType: refCtx.taskTitle });
          return followVideoGenerationTaskOnNode(node, taskId, {
              title: refCtx.taskTitle,
              fileName: data.fileName || `${refCtx.taskTitle}.mp4`,
              onError: (reason) => message.error(reason),
          });
      }
      catch (error) {
          markVideoGenerationNodeFailed(node);
          message.error(isRequestError(error) ? error.message : '视频生成失败，请稍后重试');
          return false;
      }
  };
  
  ctx.executeGroupAiTask = async function executeGroupAiTask(g: Graph, node: Node, task: GroupAiTask, refCtx: GroupAiReferenceContext, scopeIds: Set<string>, finishedAssets: Map<string, string>): Promise<{
      success: boolean;
      resultNodeId: string;
      sharedResultNodeIds?: string[];
  }> {
      ctx.selectedNodeId.value = task.nodeId;
      ctx.selectedKind.value = (node.getData() as CanvasNodeData).kind;
      ctx.syncNodeSelectionHighlight(task.nodeId);
      const sharedSiblingNodes = (task.sharedResultNodeIds ?? [])
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => Boolean(cell?.isNode()));
      switch (task.kind) {
          case 'imageCapability':
          case 'imageDialogue':
              await ctx.syncGroupAiProvenance(node, refCtx);
              return {
                  success: await ctx.executeGroupAiImageTask(node, refCtx, { sharedSiblingNodes }),
                  resultNodeId: node.id,
                  sharedResultNodeIds: task.sharedResultNodeIds,
              };
          case 'textImg2Prompt':
              return {
                  success: await ctx.executeGroupAiTextImg2PromptTask(g, node, refCtx),
                  resultNodeId: node.id,
              };
          case 'textCopy':
              return {
                  success: await ctx.executeGroupAiTextCopyTask(node),
                  resultNodeId: node.id,
              };
          case 'text2image': {
              // 整组执行：在组内已有文生图节点上原地重跑，绝不新建节点
              const target = findGroupOutgoingAiResultNode(g, task.nodeId, scopeIds, 'image') ??
                  ((node.getData() as CanvasNodeData).kind === 'image' ? node : null);
              if (!target) {
                  message.warning('组内未找到可重跑的文生图节点，已跳过');
                  return { success: false, resultNodeId: task.nodeId };
              }
              const targetCtx = resolveGroupAiReferenceContext(g, target, { ...task, kind: 'imageDialogue', nodeId: target.id }, scopeIds, finishedAssets) ?? refCtx;
              await ctx.syncGroupAiProvenance(target, targetCtx);
              ctx.selectedNodeId.value = target.id;
              ctx.selectedKind.value = 'image';
              ctx.syncNodeSelectionHighlight(target.id);
              return {
                  success: await ctx.executeGroupAiImageTask(target, targetCtx, { sharedSiblingNodes }),
                  resultNodeId: target.id,
                  sharedResultNodeIds: task.sharedResultNodeIds,
              };
          }
          case 'text2video': {
              const target = findGroupOutgoingAiResultNode(g, task.nodeId, scopeIds, 'video') ??
                  ((node.getData() as CanvasNodeData).kind === 'video' ? node : null);
              if (!target) {
                  message.warning('组内未找到可重跑的文生视频节点，已跳过');
                  return { success: false, resultNodeId: task.nodeId };
              }
              const targetCtx = resolveGroupAiReferenceContext(g, target, { ...task, kind: 'videoDialogue', nodeId: target.id }, scopeIds, finishedAssets) ?? refCtx;
              ctx.selectedNodeId.value = target.id;
              ctx.selectedKind.value = 'video';
              ctx.syncNodeSelectionHighlight(target.id);
              return {
                  success: await ctx.executeGroupAiVideoTask(target, targetCtx),
                  resultNodeId: target.id,
              };
          }
          case 'videoDialogue':
              return {
                  success: await ctx.executeGroupAiVideoTask(node, refCtx),
                  resultNodeId: node.id,
              };
          default:
              return { success: false, resultNodeId: task.nodeId };
      }
  };
  
  ctx.recordGroupTaskFinishedAsset = function recordGroupTaskFinishedAsset(g: Graph, task: GroupAiTask, resultNodeId: string, node: Node, finishedAssets: Map<string, string>) {
      const resultCell = g.getCellById(resultNodeId);
      let assetId = '';
      if (resultCell?.isNode()) {
          assetId = resolveImageAssetId(resultCell.getData() as CanvasNodeData);
      }
      if (!assetId) {
          assetId = resolveImageAssetId(node.getData() as CanvasNodeData);
      }
      if (!assetId)
          return;
      finishedAssets.set(task.nodeId, assetId);
      if (resultNodeId !== task.nodeId) {
          finishedAssets.set(resultNodeId, assetId);
      }
      for (const siblingId of task.sharedResultNodeIds ?? []) {
          const siblingCell = g.getCellById(siblingId);
          if (!siblingCell?.isNode())
              continue;
          const siblingAssetId = resolveImageAssetId(siblingCell.getData() as CanvasNodeData);
          if (siblingAssetId)
              finishedAssets.set(siblingId, siblingAssetId);
      }
  };
  
  ctx.runGroupAiGenerationPipeline = async function runGroupAiGenerationPipeline(g: Graph, groupId: string, tasks: GroupAiTask[]) {
      const scopeIds = new Set(getGroupBoxNodeIds(g, groupId));
      const finishedAssets = new Map<string, string>();
      if (!tasks.length) {
          ctx.scheduleHistoryPush();
          return;
      }
      const taskMap = new Map(tasks.map((task) => [task.nodeId, task]));
      const inDegree = new Map<string, number>();
      const adjacency = new Map<string, string[]>();
      const started = new Set<string>();
      tasks.forEach((task) => {
          inDegree.set(task.nodeId, 0);
          adjacency.set(task.nodeId, []);
      });
      tasks.forEach((task) => {
          task.dependsOn.forEach((depId) => {
              if (!taskMap.has(depId))
                  return;
              adjacency.get(depId)?.push(task.nodeId);
              inDegree.set(task.nodeId, (inDegree.get(task.nodeId) ?? 0) + 1);
          });
      });
      let remaining = tasks.length;
      let failed = false;
      let successCount = 0;
      let settle!: (error?: Error) => void;
      const done = new Promise<void>((resolve, reject) => {
          settle = (error) => {
              if (error)
                  reject(error);
              else
                  resolve();
          };
      });
      const markSettled = () => {
          remaining -= 1;
          if (remaining > 0)
              return;
          // 至少有一个节点成功则视为整组完成；全部失败才抛错
          if (successCount <= 0 && failed) {
              settle(new Error('group execute failed'));
              return;
          }
          ctx.scheduleHistoryPush();
          settle();
      };
      /** 上游失败/跳过时取消已就绪的下游，避免 remaining 无法归零 */
      const cancelTaskTree = (taskNodeId: string) => {
          if (started.has(taskNodeId))
              return;
          started.add(taskNodeId);
          markSettled();
          for (const nextId of adjacency.get(taskNodeId) ?? []) {
              const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
              inDegree.set(nextId, nextDegree);
              if (nextDegree === 0)
                  cancelTaskTree(nextId);
          }
      };
      const releaseDownstream = (taskNodeId: string, upstreamSucceeded: boolean) => {
          for (const nextId of adjacency.get(taskNodeId) ?? []) {
              const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
              inDegree.set(nextId, nextDegree);
              if (nextDegree !== 0)
                  continue;
              if (upstreamSucceeded) {
                  const nextTask = taskMap.get(nextId);
                  if (nextTask)
                      startTask(nextTask);
              }
              else {
                  cancelTaskTree(nextId);
              }
          }
      };
      const startTask = (task: GroupAiTask) => {
          if (started.has(task.nodeId))
              return;
          started.add(task.nodeId);
          void (async () => {
              let upstreamSucceeded = false;
              try {
                  const cell = g.getCellById(task.nodeId);
                  if (!cell?.isNode()) {
                      failed = true;
                      return;
                  }
                  const node = cell as Node;
                  const refCtx = resolveGroupAiReferenceContext(g, node, task, scopeIds, finishedAssets);
                  if (!refCtx) {
                      message.warning(`节点「${(node.getData() as CanvasNodeData).title || task.nodeId}」缺少可用参考资源，已跳过`);
                      failed = true;
                      return;
                  }
                  const outcome = await ctx.executeGroupAiTask(g, node, task, refCtx, scopeIds, finishedAssets);
                  if (!outcome.success) {
                      message.warning(`节点「${(node.getData() as CanvasNodeData).title || task.nodeId}」执行失败，已跳过`);
                      failed = true;
                      return;
                  }
                  successCount += 1;
                  upstreamSucceeded = true;
                  ctx.recordGroupTaskFinishedAsset(g, task, outcome.resultNodeId, node, finishedAssets);
                  ctx.bumpToolbarRevision();
                  ctx.updateGroupToolbarPosition();
                  ctx.persistGenerationTaskBinding();
              }
              catch {
                  failed = true;
              }
              finally {
                  releaseDownstream(task.nodeId, upstreamSucceeded);
                  markSettled();
              }
          })();
      };
      const roots = tasks.filter((task) => (inDegree.get(task.nodeId) ?? 0) === 0);
      if (!roots.length) {
          throw new Error('group execute failed');
      }
      roots.forEach(startTask);
      await done;
  };
  
  ctx.handleGroupAddToToolbox = function handleGroupAddToToolbox() {
      ctx.showAssetsPanel.value = true;
  };
  
  ctx.handleGroupToStoryboard = function handleGroupToStoryboard() {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group)
          return;
      mergeStoryboardGroup(g, group.nodeIds);
      ctx.selectGraphNodes(group.nodeIds);
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleGroupBatchDownload = function handleGroupBatchDownload() {
      const group = ctx.activeGroupSelection.value;
      if (!group)
          return;
      void ctx.runBatchDownloadForNodeIds(group.nodeIds);
  };
  
  ctx.handleGroupSaveToSkill = function handleGroupSaveToSkill() {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !group || !overlayRoot)
          return;
      const subgraph = extractGroupSubgraph(g, group.nodeIds);
      if (!subgraph) {
          message.warning('当前分组没有可导出的节点');
          return;
      }
      const box = getGroupScreenBox(g, group.nodeIds, overlayRoot);
      ctx.saveSkillItems.value = subgraph.nodes.map((node) => ({
          nodeId: node.id,
          label: node.fileName || node.title || `节点-${node.id.slice(-4)}`,
      }));
      ctx.saveSkillPopoverPos.value = {
          left: box.centerX,
          top: box.anchorTop + box.height / 2,
      };
      ctx.showSaveSkillPopover.value = true;
  };
  
  // 模板直接调用（:existing-skills="listSavedCanvasSkills()"），必须挂到公开面上
  ctx.listSavedCanvasSkills = listSavedCanvasSkills;
  
  ctx.closeSaveSkillPopover = function closeSaveSkillPopover() {
      ctx.showSaveSkillPopover.value = false;
      ctx.saveSkillItems.value = [];
      ctx.saveSkillSubmitting.value = false;
  };
  
  ctx.countSkillFiles = function countSkillFiles(subgraph: NonNullable<ReturnType<typeof extractGroupSubgraph>>) {
      return subgraph.nodes.filter((node) => node.previewUrl || node.fileName).length;
  };
  
  ctx.handleSubmitSaveSkill = async function handleSubmitSaveSkill(payload: {
      tab: 'new' | 'existing';
      name: string;
      role: string;
      description: string;
      tags: string[];
      existingSkillId?: string;
  }) {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group || ctx.saveSkillSubmitting.value)
          return;
      const subgraph = extractGroupSubgraph(g, group.nodeIds);
      if (!subgraph)
          return;
      ctx.saveSkillSubmitting.value = true;
      try {
          const fileCount = Math.max(1, ctx.countSkillFiles(subgraph));
          const { content } = buildGroupSkillMarkdown(subgraph, {
              name: payload.name,
              projectName: ctx.currentProjectName.value,
              description: payload.description,
              role: payload.role,
              tags: payload.tags,
          });
          if (payload.tab === 'existing' && payload.existingSkillId) {
              const existing = listSavedCanvasSkills().find((item) => item.id === payload.existingSkillId);
              if (!existing) {
                  message.warning('目标技能不存在');
                  return;
              }
              const mergedWorkflow = {
                  nodes: [...existing.workflow.nodes, ...subgraph.nodes],
                  edges: [...existing.workflow.edges, ...subgraph.edges],
              };
              const mergedMarkdown = buildGroupSkillMarkdown(mergedWorkflow, {
                  name: existing.name,
                  projectName: ctx.currentProjectName.value,
                  description: existing.description,
                  role: existing.role,
                  tags: existing.tags,
              }).content;
              const updated = await mergeCanvasSkill(payload.existingSkillId, {
                  markdown: mergedMarkdown,
                  workflow: mergedWorkflow,
                  addedNodeCount: subgraph.nodes.length,
                  addedFileCount: fileCount,
              });
              if (!updated) {
                  message.warning('加入技能失败');
                  return;
              }
              message.success(`已更新技能「${updated.name}」(含 ${updated.fileCount} 个文件)`);
              ctx.closeSaveSkillPopover();
              return;
          }
          const skill: SavedCanvasSkill = {
              id: createSkillId(),
              name: payload.name,
              role: payload.role,
              description: payload.description,
              tags: payload.tags,
              markdown: content,
              workflow: subgraph,
              nodeCount: subgraph.nodes.length,
              fileCount,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              projectId: ctx.activeProjectId.value,
          };
          await saveCanvasSkill(skill);
          message.success(`已创建技能「${skill.name}」(含 ${skill.fileCount} 个文件)`);
          ctx.closeSaveSkillPopover();
      }
      catch (error) {
          console.error('[Canvas] save skill failed', error);
          message.error('保存技能失败，请稍后重试');
      }
      finally {
          ctx.saveSkillSubmitting.value = false;
      }
  };
  
  ctx.syncGroupedNodeMove = function syncGroupedNodeMove(_node: Node) {
      // 组内节点允许单独拖拽；整组平移可通过组标题或组空白区域拖拽
  };
  
  ctx.handleGroupedNodeMoved = function handleGroupedNodeMoved(node: Node) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const leaveResult = reconcileGroupMembershipAfterNodeMove(g, node);
      if (leaveResult && !leaveResult.removed) {
          ctx.updateGroupToolbarPosition();
          return;
      }
      const joinResult = tryAdoptNodeIntoIntersectingGroup(g, node);
      if (leaveResult?.removed || joinResult) {
          ctx.bumpToolbarRevision();
      }
      ctx.updateGroupToolbarPosition();
  };
  
  ctx.resolveOverlayGroup = function resolveOverlayGroup(groupId?: string) {
      const g = ctx.graph.value;
      if (!g)
          return null;
      if (groupId) {
          const members = getNodesInGroup(g, groupId);
          if (members.length < 2)
              return null;
          return { groupId, nodeIds: members.map((node) => node.id) };
      }
      return ctx.overlayGroupSelection.value;
  };
  
  ctx.findGroupIdAtContainerPoint = function findGroupIdAtContainerPoint(clientX: number, clientY: number): string | null {
      const root = ctx.canvasRef.value;
      if (!root || !ctx.groupOverlayItems.value.length)
          return null;
      const rect = root.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const hits = ctx.groupOverlayItems.value.filter((item) => x >= item.left &&
          x <= item.left + item.width &&
          y >= item.top &&
          y <= item.top + item.height);
      if (!hits.length)
          return null;
      const activeId = ctx.overlayGroupSelection.value?.groupId;
      const activeHit = hits.find((item) => item.groupId === activeId);
      return (activeHit ?? hits[hits.length - 1]).groupId;
  };
  
  ctx.findNodeAtGraphLocalPoint = function findNodeAtGraphLocalPoint(g: Graph, local: {
      x: number;
      y: number;
  }): Node | null {
      const candidates = g
          .getNodes()
          .sort((a, b) => (b.getZIndex() ?? 0) - (a.getZIndex() ?? 0));
      return (candidates.find((node) => {
          const bbox = node.getBBox();
          return (local.x >= bbox.x &&
              local.x <= bbox.x + bbox.width &&
              local.y >= bbox.y &&
              local.y <= bbox.y + bbox.height);
      }) ?? null);
  };
  
  ctx.isGraphNodePointerTarget = function isGraphNodePointerTarget(clientX: number, clientY: number): boolean {
      const el = document.elementFromPoint(clientX, clientY);
      if (!el)
          return false;
      return Boolean(el.closest('.x6-node') ||
          el.closest('.image-node__upload-btn') ||
          el.closest('.canvas-node__delete-float') ||
          el.closest('.node-port-plus'));
  };
  
  ctx.findGroupBlankAreaAtClientPoint = function findGroupBlankAreaAtClientPoint(clientX: number, clientY: number): string | null {
      if (ctx.isGraphNodePointerTarget(clientX, clientY))
          return null;
      const groupId = ctx.findGroupIdAtContainerPoint(clientX, clientY);
      if (!groupId)
          return null;
      const g = ctx.graph.value;
      if (!g)
          return null;
      const local = clientPointToGraphLocal(g, clientX, clientY);
      if (ctx.findNodeAtGraphLocalPoint(g, local))
          return null;
      return groupId;
  };
  
  ctx.syncGroupBlankHoverCursor = function syncGroupBlankHoverCursor(event: MouseEvent) {
      const root = ctx.graphRef.value;
      if (!root || ctx.groupOverlayDrag.active) {
          root?.classList.remove('canvas__graph--group-blank-hover');
          return;
      }
      const groupId = ctx.findGroupBlankAreaAtClientPoint(event.clientX, event.clientY);
      root.classList.toggle('canvas__graph--group-blank-hover', Boolean(groupId));
  };
  
  ctx.onCanvasGroupBlankPointerMove = function onCanvasGroupBlankPointerMove(event: MouseEvent) {
      ctx.syncGroupBlankHoverCursor(event);
  };
  
  ctx.resetGroupBlankHoverCursor = function resetGroupBlankHoverCursor() {
      ctx.graphRef.value?.classList.remove('canvas__graph--group-blank-hover');
      ctx.graphRef.value?.classList.remove('canvas__graph--group-blank-grabbing');
  };
  
  ctx.groupOverlayDragCleanup = null;
  
  ctx.stopGroupOverlayDrag = function stopGroupOverlayDrag() {
      ctx.groupOverlayDragCleanup?.();
      ctx.groupOverlayDragCleanup = null;
      ctx.groupOverlayDrag.active = false;
      ctx.resetGroupBlankHoverCursor();
  };
  
  ctx.onGroupOverlayDragStart = function onGroupOverlayDragStart(payload: {
      event: MouseEvent;
      groupId: string;
  }) {
      const g = ctx.graph.value;
      const root = ctx.graphRef.value;
      const group = ctx.resolveOverlayGroup(payload.groupId);
      if (!g || !root || !group)
          return;
      ctx.stopGroupOverlayDrag();
      ctx.cancelBlankPanGesture();
      cancelActiveRubberband(g);
      const scroller = getScroller(g);
      const suspendCanvasPan = ctx.panMode.value;
      if (suspendCanvasPan)
          scroller?.togglePanning(false);
      ctx.groupOverlayDrag.active = true;
      ctx.groupOverlayDrag.nodeIds = [...group.nodeIds];
      const groupId = group.groupId;
      const local = clientPointToGraphLocal(g, payload.event.clientX, payload.event.clientY);
      ctx.groupOverlayDrag.lastGraphX = local.x;
      ctx.groupOverlayDrag.lastGraphY = local.y;
      ctx.graphRef.value?.classList.add('canvas__graph--group-blank-grabbing');
      let ended = false;
      const onMove = (moveEvent: MouseEvent) => {
          if (!ctx.groupOverlayDrag.active)
              return;
          const current = clientPointToGraphLocal(g, moveEvent.clientX, moveEvent.clientY);
          const dx = current.x - ctx.groupOverlayDrag.lastGraphX;
          const dy = current.y - ctx.groupOverlayDrag.lastGraphY;
          if (!dx && !dy)
              return;
          ctx.groupOverlayDrag.nodeIds.forEach((id) => {
              const node = g.getCellById(id);
              if (!node?.isNode())
                  return;
              const pos = node.getPosition();
              node.position(pos.x + dx, pos.y + dy);
          });
          const storedBox = getStoredGroupSelectionBox(g, groupId);
          if (storedBox) {
              setStoredGroupSelectionBox(g, groupId, {
                  ...storedBox,
                  x: storedBox.x + dx,
                  y: storedBox.y + dy,
              });
          }
          ctx.groupOverlayDrag.lastGraphX = current.x;
          ctx.groupOverlayDrag.lastGraphY = current.y;
          ctx.updateNodeToolbar();
          ctx.updateGroupToolbarPosition();
      };
      const onEnd = () => {
          if (ended)
              return;
          ended = true;
          ctx.stopGroupOverlayDrag();
          cancelActiveRubberband(g);
          if (suspendCanvasPan && ctx.panMode.value)
              scroller?.togglePanning(true);
          ctx.updateGroupToolbarPosition();
          ctx.scheduleHistoryPush();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd, true);
      window.addEventListener('pointerup', onEnd, true);
      window.addEventListener('pointercancel', onEnd, true);
      ctx.groupOverlayDragCleanup = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd, true);
          window.removeEventListener('pointerup', onEnd, true);
          window.removeEventListener('pointercancel', onEnd, true);
      };
  };
  
  ctx.onGroupOverlaySelectGroup = function onGroupOverlaySelectGroup(groupId: string) {
      const group = ctx.resolveOverlayGroup(groupId);
      if (!group)
          return;
      ctx.selectGraphNodes(group.nodeIds);
      ctx.bumpToolbarRevision();
      nextTick(() => ctx.updateGroupToolbarPosition());
  };
  
  ctx.onGroupOverlayTitleChange = function onGroupOverlayTitleChange(payload: {
      groupId: string;
      title: string;
  }) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const members = getNodesInGroup(g, payload.groupId);
      if (members.length < 2)
          return;
      const defaultTitle = `分组 ${members.length} 个节点`;
      const next = payload.title.trim();
      if (!next || next === defaultTitle) {
          setGroupTitle(g, payload.groupId, '');
      }
      else {
          setGroupTitle(g, payload.groupId, next);
      }
      ctx.bumpToolbarRevision();
      ctx.updateGroupToolbarPosition();
      ctx.scheduleHistoryPush();
  };
  
  ctx.onGroupOverlayResizeStart = function onGroupOverlayResizeStart(payload: {
      event: MouseEvent;
      handle: GroupResizeHandle;
      groupId: string;
  }) {
      const g = ctx.graph.value;
      const group = ctx.resolveOverlayGroup(payload.groupId);
      if (!g || !group)
          return;
      const memberIds = getNodesInGroup(g, group.groupId).map((node) => node.id);
      const memberContentBox = getGroupGraphBBox(g, memberIds);
      const startBox = resolveGroupGraphBBox(g, group.groupId, memberIds);
      const startPointer = clientPointToGraphLocal(g, payload.event.clientX, payload.event.clientY);
      ctx.groupOverlayResize.active = true;
      ctx.groupOverlayResize.handle = payload.handle;
      ctx.groupOverlayResize.groupId = group.groupId;
      ctx.groupOverlayResize.startBox = { ...startBox };
      ctx.groupOverlayResize.currentBox = { ...startBox };
      ctx.groupOverlayResize.startPointerX = startPointer.x;
      ctx.groupOverlayResize.startPointerY = startPointer.y;
      ctx.updateGroupToolbarPosition();
      const onMove = (moveEvent: MouseEvent) => {
          if (!ctx.groupOverlayResize.active)
              return;
          const current = clientPointToGraphLocal(g, moveEvent.clientX, moveEvent.clientY);
          const dx = current.x - ctx.groupOverlayResize.startPointerX;
          const dy = current.y - ctx.groupOverlayResize.startPointerY;
          ctx.groupOverlayResize.currentBox = resizeGroupGraphBox(ctx.groupOverlayResize.startBox, ctx.groupOverlayResize.handle as GroupResizeHandle, dx, dy, memberContentBox);
          ctx.updateGroupToolbarPosition();
      };
      const onUp = () => {
          if (!ctx.groupOverlayResize.active)
              return;
          const box = { ...ctx.groupOverlayResize.currentBox };
          const groupId = ctx.groupOverlayResize.groupId;
          ctx.groupOverlayResize.active = false;
          ctx.groupOverlayResize.handle = '';
          ctx.groupOverlayResize.groupId = '';
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          const memberIds = applyGroupSelectionBoxResize(g, groupId, box);
          if (memberIds.length >= 2) {
              ctx.selectGraphNodes(memberIds);
          }
          else if (memberIds.length === 1) {
              ctx.selectGraphNodes(memberIds);
          }
          else {
              ctx.syncSelectionFromGraph();
          }
          ctx.bumpToolbarRevision();
          nextTick(() => {
              ctx.updateGroupToolbarPosition();
              ctx.updateNodeToolbar();
          });
          ctx.scheduleHistoryPush();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
  };
  
  ctx.pasteNodePayload = function pasteNodePayload(payload: Record<string, unknown>, offsetIndex = 0, options?: {
      newId?: string;
      idMap?: Map<string, string>;
  }) {
      const g = ctx.graph.value;
      if (!g)
          return null;
      const oldId = String(payload.id ?? '');
      const newId = options?.newId || ctx.createPastedCanvasNodeId();
      if (oldId && options?.idMap) {
          options.idMap.set(oldId, newId);
      }
      const x = typeof payload.x === 'number'
          ? payload.x
          : typeof (payload.position as {
              x?: number;
          } | undefined)?.x === 'number'
              ? (payload.position as {
                  x: number;
              }).x
              : 0;
      const y = typeof payload.y === 'number'
          ? payload.y
          : typeof (payload.position as {
              y?: number;
          } | undefined)?.y === 'number'
              ? (payload.position as {
                  y: number;
              }).y
              : 0;
      const rawData = (payload.data ?? {}) as CanvasNodeData;
      const data = ctx.sanitizePastedNodeData(rawData, {
          oldId: oldId || undefined,
          idMap: options?.idMap,
      });
      const { id: _removed, data: _data, x: _x, y: _y, position: _position, ...rest } = payload;
      const node = g.addNode({
          ...rest,
          id: newId,
          x: x + 32 + offsetIndex * 16,
          y: y + 32 + offsetIndex * 16,
          data,
      });
      return node;
  };
  
  ctx.pasteNode = function pasteNode() {
      const g = ctx.graph.value;
      const payload = ctx.nodeClipboard.value;
      if (!g || !payload)
          return;
      if (Array.isArray(payload)) {
          const idMap = new Map<string, string>();
          const newNodes = payload
              .map((item, index) => {
              const oldId = String(item.id ?? '');
              const newId = ctx.createPastedCanvasNodeId();
              if (oldId)
                  idMap.set(oldId, newId);
              return ctx.pasteNodePayload(item, index, { newId, idMap });
          })
              .filter((node): node is Node => node != null);
          // idMap 齐全后再修正节点间引用
          newNodes.forEach((node, index) => {
              const oldId = String(payload[index]?.id ?? '');
              const data = ctx.sanitizePastedNodeData(node.getData() as CanvasNodeData, {
                  oldId: oldId || undefined,
                  idMap,
              });
              node.setData(data, { overwrite: true });
          });
          // 粘贴多选时，按原图画布上仍存在的边结构，复制到新节点之间
          const oldIds = new Set(payload.map((item) => String(item.id ?? '')).filter(Boolean));
          const edgesToClone: Array<{
              source: string;
              target: string;
              attrs: Record<string, unknown>;
              zIndex: number | undefined;
          }> = [];
          g.getEdges().forEach((edge) => {
              const sourceId = edge.getSourceCellId();
              const targetId = edge.getTargetCellId();
              if (!sourceId || !targetId || !oldIds.has(sourceId) || !oldIds.has(targetId))
                  return;
              if (!idMap.has(sourceId) || !idMap.has(targetId))
                  return;
              edgesToClone.push({
                  source: sourceId,
                  target: targetId,
                  attrs: edge.getAttrs() as Record<string, unknown>,
                  zIndex: edge.getZIndex(),
              });
          });
          edgesToClone.forEach((item) => {
              const nextSourceId = idMap.get(item.source);
              const nextTargetId = idMap.get(item.target);
              if (!nextSourceId || !nextTargetId)
                  return;
              g.addEdge({
                  source: { cell: nextSourceId, port: 'right' },
                  target: { cell: nextTargetId, port: 'left' },
                  attrs: item.attrs,
                  zIndex: item.zIndex,
              });
          });
          if (!newNodes.length)
              return;
          ctx.selectGraphNodes(newNodes);
          ctx.syncNodeCount();
          ctx.scheduleHistoryPush();
          return;
      }
      const node = ctx.pasteNodePayload(payload);
      if (!node)
          return;
      const data = node.getData() as CanvasNodeData;
      node.setData({ ...data, isSelected: true }, { overwrite: true });
      ctx.selectGraphNodes(node);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
  };
  
  ctx.getSelectedNode = function getSelectedNode() {
      const g = ctx.graph.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      return cell?.isNode() ? (cell as Node) : null;
  };
  
  ctx.moveNodeLayer = function moveNodeLayer(step: 'front' | 'back' | 'forward' | 'backward') {
      const g = ctx.graph.value;
      const node = ctx.getSelectedNode();
      if (!g || !node)
          return;
      if (step === 'front') {
          node.toFront();
      }
      else if (step === 'back') {
          node.toBack();
      }
      else {
          const nodes = g
              .getNodes()
              .slice()
              .sort((a, b) => (a.getZIndex() ?? 0) - (b.getZIndex() ?? 0));
          const idx = nodes.findIndex((n) => n.id === node.id);
          const targetIdx = step === 'forward' ? idx + 1 : idx - 1;
          const current = nodes[idx];
          const target = nodes[targetIdx];
          if (!current || !target || targetIdx < 0 || targetIdx >= nodes.length)
              return;
          const zA = current.getZIndex() ?? 0;
          const zB = target.getZIndex() ?? 0;
          current.setZIndex(zB);
          target.setZIndex(zA);
      }
      ctx.scheduleHistoryPush();
  };
  
  ctx.openMediaPreview = function openMediaPreview() {
      const node = ctx.getSelectedNode();
      if (!node)
          return;
      const data = node.getData() as CanvasNodeData;
      if ((data.kind !== 'image' && data.kind !== 'video') || !data.previewUrl)
          return;
      ctx.closeImageToolbarMore();
      ctx.showImageHdMenu.value = false;
      ctx.imagePreviewKind.value = data.kind === 'video' ? 'video' : 'image';
      ctx.imagePreviewUrl.value = data.previewUrl;
  };
  
  ctx.openImagePreview = function openImagePreview() {
      ctx.openMediaPreview();
  };
  
  ctx.closeImagePreview = function closeImagePreview() {
      ctx.imagePreviewUrl.value = '';
      ctx.imagePreviewKind.value = 'image';
  };
  
  ctx.cancelCurrentOperation = function cancelCurrentOperation() {
      return ctx.dismissOneCanvasLayer();
  };
  
  ctx.triggerCanvasUploadShortcut = function triggerCanvasUploadShortcut() {
      ctx.addMenuDropPoint.value = ctx.getGraphCenter();
      ctx.openFileUploadPicker('image/*,video/*', 'any', true);
  };
  
  ctx.handleGroupBlankMouseDown = function handleGroupBlankMouseDown({ e }: {
      e: MouseEvent;
  }) {
      if (e.button !== 0)
          return;
      if (ctx.isGraphNodePointerTarget(e.clientX, e.clientY))
          return;
      if (e.detail >= 2) {
          ctx.resetCanvasPanCursorState();
          return;
      }
      if (ctx.showVideoGenCanvasPickMode.value || ctx.showImageDialogueCanvasPickMode.value) {
          return;
      }
      const groupId = ctx.findGroupBlankAreaAtClientPoint(e.clientX, e.clientY);
      if (!groupId)
          return;
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.cancelBlankPanGesture();
      cancelActiveRubberband(g);
      e.preventDefault();
      e.stopPropagation();
      ctx.onGroupOverlaySelectGroup(groupId);
      ctx.onGroupOverlayDragStart({ event: e, groupId });
  };
}
