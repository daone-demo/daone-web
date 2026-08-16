// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Groups AI 任务执行 / pipeline 到 ctx。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { resolveGenerationTaskWorkflowId,resolveImageAssetId,toVideoApiClarity } from '../../../../constants';
import { buildImageGenerationParams,buildTextGenerationParams,persistNodeGenerationSnapshot } from '../../../../generationParams';
import { applyGenerationResultToNode,bindGenerationTaskId,followTextGenerationTaskOnNode,followVideoGenerationTaskOnNode,markGenerationNodeFailed,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,readGenerationResultIndex,resolveGenerationResultPreview,runImageGenerationOnNode,updateGenerationNodeProgress,type GenerationTaskDetail } from '../../../../generationTask';
import { findGroupOutgoingAiResultNode,resolveGroupAiReferenceContext,type GroupAiReferenceContext,type GroupAiTask,} from '../../../../groupExecute';
import { toVideoApiPrompt } from '../../../../promptMention';
import type { CanvasNodeData } from '../../sharedImports';
import { api,applyVideoFirstLastFrameParameters,getGroupBoxNodeIds,IMG2PROMPT_DEFAULT_INSTRUCTION,prepareImageNodeForInPlaceGeneration,resetVideoGenerationNodeForRetry,syncTextNodeImageSource } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installGroupAiExecute(ctx: CoreRuntimeContext) {
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
  
}
