// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 PromptGeneration 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { canOpenImageDialogueOnNode,createDefaultImageDialogueSettings,isPendingImageGenDialogueTarget,isVideoNodeGenerating,resolveGenerationTaskWorkflowId,resolveImageAssetId,type CanvasGenerationParams,type ImageDialogueSettings,type ImageMarkItem,type ImageToolbarClickEvent } from '../../../constants';
import { buildImageGenerationParams,cloneNodeGenerationSnapshot,persistNodeGenerationSnapshot } from '../../../generationParams';
import { applyGenerationResultToNode,bindGenerationTaskId,bindSharedGenerationTaskId,markGenerationNodeFailed,pickImageGenerationResults,readGenerationResultIndex,resolveGenerationResultPreview,startImageGenerationOnNode,type GenerationTaskDetail,type GenerationTaskResult } from '../../../generationTask';
import { syncNodeImageMarkLists } from '../../../imageMarkUtils';
import { downloadCanvasMedia } from '../../../mediaDownload';
import type { CanvasNodeData,ImageSourceRef } from '.././sharedImports';
import { api,connectGenEdge,getImageGenerationPlaceholderSize,getNodeDialoguePosition,getScroller,isVideoGenerationFailedNode,planOutgoingResultPoints,spawnCompletedImageResultNode,spawnCroppedImageNode,spawnGenerationResultNode,syncPendingImageTargetFromSources } from '.././sharedImports';
import type { UploadFilter } from '.././state';
import type { CoreRuntimeContext } from './context';

export function installPromptGeneration(ctx: CoreRuntimeContext) {
  ctx.ensureGenerationResultLoadingNodes = function ensureGenerationResultLoadingNodes(g: Graph, sourceNode: Node, resultNodes: Node[], totalCount: number, config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      placement?: import('../../../imageGen').ResultPlacement;
      snapshotSourceNode?: Node;
  }) {
      if (totalCount <= resultNodes.length)
          return;
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, totalCount, config.placement ?? 'right');
      const snapshotSource = config.snapshotSourceNode ?? resultNodes[0];
      for (let index = resultNodes.length; index < totalCount; index += 1) {
          const node = spawnGenerationResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, index, totalCount),
              centerPoint: plannedPoints[index],
              layoutSlot: index,
              layoutTotal: totalCount,
          });
          if (snapshotSource) {
              cloneNodeGenerationSnapshot(snapshotSource, node);
              const sharedTaskId = String((snapshotSource.getData() as CanvasNodeData).generationTaskId ?? '').trim();
              if (sharedTaskId) {
                  bindGenerationTaskId(node, sharedTaskId, 'IMAGE', index);
              }
              else {
                  const data = { ...(node.getData() as CanvasNodeData), generationResultIndex: index };
                  node.setData(data, { overwrite: true });
              }
          }
          resultNodes.push(node);
      }
  };
  
  ctx.distributeMultiImageGenerationResults = async function distributeMultiImageGenerationResults(g: Graph, sourceNode: Node, resultNodes: Node[], allResults: GenerationTaskResult[], config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      placement?: import('../../../imageGen').ResultPlacement;
  }): Promise<Node[]> {
      const totalCount = allResults.length;
      if (totalCount <= 1)
          return [];
      ctx.ensureGenerationResultLoadingNodes(g, sourceNode, resultNodes, totalCount, {
          ...config,
          snapshotSourceNode: resultNodes[0],
      });
      const appliedNodes: Node[] = [];
      const failedResults: {
          result: GenerationTaskResult;
          index: number;
      }[] = [];
      for (let index = 1; index < totalCount; index += 1) {
          const node = resultNodes[index];
          const result = allResults[index];
          if (!node || !result)
              continue;
          const data = node.getData() as CanvasNodeData;
          if (data.previewUrl?.trim() && data.imageGenState !== 'loading') {
              appliedNodes.push(node);
              continue;
          }
          const resolved = await resolveGenerationResultPreview(result);
          if (!resolved?.previewUrl?.trim()) {
              failedResults.push({ result, index });
              continue;
          }
          const didApply = await applyGenerationResultToNode(node, resolved, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, index, totalCount),
          });
          if (didApply) {
              appliedNodes.push(node);
          }
          else {
              failedResults.push({ result, index });
          }
      }
      for (const item of failedResults) {
          const spawnedNodes = await ctx.spawnNodesForExtraGenerationResults(g, sourceNode, [item.result], {
              title: config.title,
              sourceFileName: config.sourceFileName,
              buildFileName: config.buildFileName,
              resultIndexOffset: item.index,
              totalCount,
              placement: config.placement,
              snapshotSourceNode: resultNodes[0],
          });
          appliedNodes.push(...spawnedNodes);
      }
      // 多结果共享同一 taskId，便于整组执行时只跑一次
      const primary = resultNodes[0];
      const sharedTaskId = primary
          ? String((primary.getData() as CanvasNodeData).generationTaskId ?? '').trim()
          : '';
      if (sharedTaskId) {
          const members: Array<{
              node: Node;
              resultIndex: number;
          }> = [];
          for (let index = 0; index < resultNodes.length; index += 1) {
              const node = resultNodes[index];
              if (!node)
                  continue;
              members.push({ node, resultIndex: index });
          }
          for (const node of appliedNodes) {
              if (members.some((item) => item.node.id === node.id))
                  continue;
              const idx = readGenerationResultIndex(node.getData() as CanvasNodeData);
              members.push({ node, resultIndex: idx });
          }
          bindSharedGenerationTaskId(members, sharedTaskId, 'IMAGE');
      }
      return appliedNodes;
  };
  
  ctx.spawnNodesForExtraGenerationResults = async function spawnNodesForExtraGenerationResults(g: Graph, sourceNode: Node, extraResults: GenerationTaskResult[], config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      resultIndexOffset: number;
      totalCount: number;
      placement?: import('../../../imageGen').ResultPlacement;
      snapshotSourceNode?: Node;
  }): Promise<Node[]> {
      const nodes: Node[] = [];
      if (!extraResults.length)
          return nodes;
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, extraResults.length, config.placement ?? 'right');
      let pointIndex = 0;
      for (let index = 0; index < extraResults.length; index += 1) {
          const resolved = await resolveGenerationResultPreview(extraResults[index]);
          if (!resolved?.previewUrl?.trim())
              continue;
          const node = spawnCompletedImageResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, config.resultIndexOffset + index, config.totalCount),
              previewUrl: resolved.previewUrl,
              assetId: resolved.assetId,
              mediaWidth: resolved.width ?? undefined,
              mediaHeight: resolved.height ?? undefined,
              centerPoint: plannedPoints[pointIndex],
          });
          if (config.snapshotSourceNode) {
              cloneNodeGenerationSnapshot(config.snapshotSourceNode, node);
          }
          const sharedTaskId = String(((config.snapshotSourceNode?.getData() as CanvasNodeData | undefined) ??
              (sourceNode.getData() as CanvasNodeData)).generationTaskId ?? '').trim();
          const resultIndex = config.resultIndexOffset + index;
          if (sharedTaskId) {
              bindGenerationTaskId(node, sharedTaskId, 'IMAGE', resultIndex);
          }
          const extraData = { ...(node.getData() as CanvasNodeData) };
          extraData.imageGenState = 'done';
          extraData.imageGenProgress = 100;
          if (!sharedTaskId) {
              extraData.generationResultIndex = resultIndex;
          }
          node.setData(extraData, { overwrite: true });
          pointIndex += 1;
          nodes.push(node);
      }
      return nodes;
  };
  
  ctx.applyToolbarImageGenerationSnapshot = function applyToolbarImageGenerationSnapshot(targetNode: Node, sourceNode: Node, sourceData: CanvasNodeData, config: {
      capabilityCode: string;
      prompt: string;
      parameters: Record<string, unknown>;
      referenceAssetIds?: string[];
      workflowId?: string | number | null;
  }) {
      const provenanceRefs = ctx.getImageDialoguePreviewsForNode(sourceNode.id);
      const provenancePrompt = config.prompt.trim() ||
          sourceData.imageDialogueText?.trim() ||
          sourceData.genPrompt?.trim() ||
          '';
      const provenanceSettings = ctx.normalizeImageDialogueSettings(sourceData.imageDialogueSettings);
      ctx.applyImageDialogueProvenance(targetNode, {
          prompt: provenancePrompt,
          settings: provenanceSettings,
          sourceRefs: provenanceRefs.length
              ? provenanceRefs
              : ctx.seedImageDialogueRefs(sourceData, sourceNode.id),
          generationParams: buildImageGenerationParams({
              prompt: provenancePrompt,
              capabilityCode: config.capabilityCode,
              parameters: config.parameters,
              workflowId: resolveGenerationTaskWorkflowId(config.workflowId) ?? undefined,
              referenceAssetIds: config.referenceAssetIds?.length ? config.referenceAssetIds : undefined,
          }),
      });
  };
  
  ctx.runImageGenerationTask = async function runImageGenerationTask(event: ImageToolbarClickEvent, config: {
      capabilityCode: string;
      title: string;
      prompt?: string;
      workflowId?: string | number | null;
      requireAssetId?: boolean;
      requireSourcePreview?: boolean;
      resultPlacement?: import('../../../imageGen').ResultPlacement;
      buildFileName: (sourceFileName: string) => string;
      buildParameters: (event: ImageToolbarClickEvent) => Record<string, unknown>;
      resolveReferenceAssetIds?: (event: ImageToolbarClickEvent) => string[];
  }) {
      const requireAssetId = config.requireAssetId !== false;
      if (requireAssetId && !event.assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      const g = ctx.graph.value;
      const sourceNodeId = ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      const requireSourcePreview = config.requireSourcePreview !== false;
      if (requireSourcePreview && !sourceData.previewUrl)
          return;
      if (sourceData.uploadState === 'uploading')
          return;
      // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
      //   message.info('当前图片已有进行中的生成任务')
      //   return
      // }
      ctx.resetImageDialogue();
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      const taskParameters = config.buildParameters(event);
      const requestedCount = Math.max(1, Math.floor(Number(taskParameters.count)) || 1);
      const singleTaskParameters = { ...taskParameters, count: 1 };
      const resultNodes: Node[] = [];
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, requestedCount, config.resultPlacement ?? 'right');
      for (let index = 0; index < requestedCount; index += 1) {
          resultNodes.push(spawnGenerationResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, sourceFileName, index, requestedCount),
              centerPoint: plannedPoints[index],
          }));
      }
      const referenceAssetIds = config.resolveReferenceAssetIds?.(event) ??
          (event.assetId ? [event.assetId] : []);
      ctx.recordCanvasDescription(config.title, '');
      resultNodes.forEach((resultNode) => {
          ctx.applyToolbarImageGenerationSnapshot(resultNode, sourceNode, sourceData, {
              capabilityCode: config.capabilityCode,
              prompt: config.prompt ?? '',
              parameters: singleTaskParameters,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
              workflowId: config.workflowId,
          });
      });
      const primaryNode = resultNodes[0];
      ctx.selectedNodeId.value = primaryNode.id;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(primaryNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      const distributionConfig = {
          title: config.title,
          sourceFileName,
          buildFileName: config.buildFileName,
          placement: config.resultPlacement,
      };
      const runners = resultNodes.map((resultNode, index) => {
          const fileName = ctx.resolveGenerationResultFileName(config.buildFileName, sourceFileName, index, requestedCount);
          return startImageGenerationOnNode(resultNode, {
              title: config.title,
              fileName,
              createTask: async () => {
                  const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                      ? crypto.randomUUID()
                      : `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
                  const created = await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'IMAGE',
                      capabilityCode: config.capabilityCode,
                      prompt: config.prompt?.trim() ?? '',
                      parameters: singleTaskParameters,
                      projectId: ctx.activeProjectId.value,
                      nodeId: resultNode.id,
                      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
                      workflowId: resolveGenerationTaskWorkflowId(config.workflowId),
                  }, idempotencyKey);
                  ctx.userInfoStore.queryPointAccount();
                  return created;
              },
              onTaskCreated: (created) => {
                  if (index !== 0)
                      return;
                  const apiResultCount = pickImageGenerationResults(created).length;
                  if (apiResultCount <= 1)
                      return;
                  ctx.ensureGenerationResultLoadingNodes(g, sourceNode, resultNodes, apiResultCount, {
                      ...distributionConfig,
                      snapshotSourceNode: primaryNode,
                  });
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
              },
              onTaskBound: () => ctx.persistGenerationTaskBinding(resultNode, {
                  detail: config.prompt?.trim() ||
                      (resultNode.getData() as CanvasNodeData).genPrompt?.trim() ||
                      config.title,
                  taskType: config.title,
              }),
              onError: (reason) => message.error(reason),
              onComplete: async (result) => {
                  ctx.resetSourceImageDialogueAfterSuccess(sourceNode, resultNode, result);
                  if (!result.success || index !== 0)
                      return;
                  const allResults = result.allResults ?? [];
                  if (allResults.length <= 1)
                      return;
                  const extraNodes = await ctx.distributeMultiImageGenerationResults(g, sourceNode, resultNodes, allResults, distributionConfig);
                  if (!extraNodes.length)
                      return;
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
                  ctx.scheduleHistoryPush();
                  nextTick(() => {
                      const scroller = getScroller(g);
                      if (!scroller)
                          return;
                      const boxes = [primaryNode, ...extraNodes].map((node) => node.getBBox());
                      const minX = Math.min(...boxes.map((box) => box.x));
                      const maxX = Math.max(...boxes.map((box) => box.x + box.width));
                      const minY = Math.min(...boxes.map((box) => box.y));
                      const maxY = Math.max(...boxes.map((box) => box.y + box.height));
                      scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, {
                          duration: '280ms',
                      });
                  });
              },
          });
      });
      try {
          const outcomes = await Promise.allSettled(runners);
          const started = outcomes.some((outcome) => outcome.status === 'fulfilled' && outcome.value.started);
          if (!started)
              return;
          ctx.resetImageDialogue();
      }
      catch (error) {
          resultNodes.forEach((node) => markGenerationNodeFailed(node));
          message.error(isRequestError(error) ? error.message : '生成失败，请稍后重试');
      }
  };
  
  ctx.handleImageDownloadAction = function handleImageDownloadAction(event: ImageToolbarClickEvent) {
      void event.assetId;
      const data = ctx.getSelectedNodeData();
      const url = data?.previewUrl;
      if (!url) {
          message.warning('图片尚未准备好，无法下载');
          return;
      }
      void downloadCanvasMedia({
          url,
          fallbackName: 'image',
      }).catch((error) => {
          message.error(isRequestError(error) ? error.message : '图片下载失败，请稍后重试');
      });
  };
  
  ctx.openImageCrop = async function openImageCrop() {
      const ready = await ctx.ensureImageEditorReady('裁剪');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageGridSplit();
      ctx.closeImageErase();
      ctx.closeImageInpaint();
      ctx.closeImageExpand();
      ctx.closeImageEditText();
      ctx.cropSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.showImageCrop.value = true;
      ctx.updateNodeToolbar();
  };
  
  ctx.closeImageCrop = function closeImageCrop() {
      ctx.showImageCrop.value = false;
      ctx.cropSourceNodeId.value = '';
      ctx.updateNodeToolbar();
  };
  
  ctx.resetImageCrop = function resetImageCrop() {
      ctx.showImageCrop.value = false;
      ctx.cropSourceNodeId.value = '';
  };
  
  ctx.onImageCropComplete = function onImageCropComplete(payload: {
      dataUrl: string;
      width: number;
      height: number;
  }) {
      const g = ctx.graph.value;
      const id = ctx.cropSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !id) {
          ctx.closeImageCrop();
          return;
      }
      const cell = g.getCellById(id);
      if (!cell?.isNode()) {
          ctx.closeImageCrop();
          return;
      }
      const sourceNode = cell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      const fileName = sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png';
      const localPreviewUrl = payload.dataUrl;
      ctx.closeImageCrop();
      const croppedNode = spawnCroppedImageNode(g, sourceNode, payload);
      ctx.focusErasedResultNode(g, croppedNode);
      void ctx.uploadLocalImageNodeInBackground(croppedNode, localPreviewUrl, fileName, payload).then(() => {
          ctx.scheduleHistoryPush();
      });
  };
  
  ctx.resetImageToolbarMore = function resetImageToolbarMore() {
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.showImageHdMenu.value = false;
  };
  
  ctx.closeVideoSubPanels = function closeVideoSubPanels(except?: 'dialogue' | 'hd' | 'frames') {
      if (except !== 'dialogue')
          ctx.showVideoDialogue.value = false;
      if (except !== 'hd')
          ctx.showVideoHdPanel.value = false;
      if (except !== 'frames')
          ctx.showVideoFramesPanel.value = false;
  };
  
  ctx.openImageDialogue = function openImageDialogue(nodeId?: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const id = nodeId ?? ctx.selectedNodeId.value;
      if (!id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'image')
          return;
      if (ctx.activeImageDialogueNodeId && ctx.activeImageDialogueNodeId !== id) {
          ctx.persistImageDialogueFields(ctx.activeImageDialogueNodeId);
      }
      ctx.selectedNodeId.value = id;
      ctx.selectedKind.value = 'image';
      const refs = ctx.seedImageDialogueRefs(data, id);
      if (refs.length) {
          const currentRefs = Array.isArray(data.imageSourceRefs)
              ? data.imageSourceRefs.filter((item) => item.previewUrl)
              : [];
          const refsChanged = currentRefs.length !== refs.length ||
              refs.some((item, index) => item.nodeId !== currentRefs[index]?.nodeId ||
                  item.previewUrl !== currentRefs[index]?.previewUrl);
          if (!currentRefs.length || refsChanged) {
              ctx.syncImageDialogueSourceRefs(cell as Node, refs);
          }
      }
      syncPendingImageTargetFromSources(g, cell as Node);
      ctx.loadImageDialogueFields(id);
      ctx.showImageDialogue.value = true;
      ctx.showImageHdMenu.value = false;
      ctx.closeImageGenPromptBar();
      // 对齐图上钉点与对话框标记列表，避免只存在一侧
      syncNodeImageMarkLists(cell as Node);
      for (const ref of ctx.getImageDialoguePreviewsForNode(id)) {
          if (!ref.nodeId || ref.nodeId === id)
              continue;
          const sourceCell = g.getCellById(ref.nodeId);
          if (sourceCell?.isNode())
              syncNodeImageMarkLists(sourceCell as Node);
      }
      // 从其他节点的标记模式切过来时，退出标记选点，避免「识别中」带到新对话框
      if (ctx.showElementSelectMode.value &&
          ctx.elementSelectReturnNodeId.value &&
          ctx.elementSelectReturnNodeId.value !== id) {
          ctx.exitElementSelectMode();
      }
      // 待生成节点不提供标记能力：打开时退出标记模式
      if (isPendingImageGenDialogueTarget(data) && ctx.showElementSelectMode.value) {
          ctx.exitElementSelectMode({ force: true });
      }
      ctx.syncNodeSelectionHighlight(id);
      ctx.updateNodeToolbar();
  };
  
  ctx.toggleImageDialogue = function toggleImageDialogue() {
      if (ctx.showImageDialogue.value) {
          ctx.resetImageDialogue();
      }
      else {
          ctx.openImageDialogue();
      }
      ctx.showImageHdMenu.value = false;
  };
  
  ctx.handleImageNodeDblClick = function handleImageNodeDblClick({ node }: {
      node: Node;
  }) {
      const data = node.getData() as CanvasNodeData;
      if (!ctx.canAutoOpenImageDialogue(data))
          return;
      ctx.openImageDialogue(node.id);
  };
  
  ctx.revealVideoDialogueAfterGenerationFailure = function revealVideoDialogueAfterGenerationFailure(nodeId: string) {
      const g = ctx.graph.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'video' || !isVideoGenerationFailedNode(data))
          return;
      ctx.openVideoDialogue(nodeId);
  };
  
  ctx.handleVideoGenerationTaskComplete = function handleVideoGenerationTaskComplete(nodeId: string, success: boolean) {
      if (!success) {
          ctx.revealVideoDialogueAfterGenerationFailure(nodeId);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      const g = ctx.graph.value;
      const cell = g?.getCellById(nodeId);
      if (cell?.isNode()) {
          ctx.persistGenerationTaskBinding(cell as Node);
      }
      else {
          ctx.persistGenerationTaskBinding();
      }
  };
  
  ctx.openVideoDialogue = function openVideoDialogue(nodeId?: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const id = nodeId ?? ctx.selectedNodeId.value;
      if (!id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'video')
          return;
      ctx.cancelVideoToolbarDefer();
      if (ctx.activeVideoDialogueNodeId && ctx.activeVideoDialogueNodeId !== id) {
          ctx.persistVideoDialogueFields(ctx.activeVideoDialogueNodeId);
      }
      ctx.selectedNodeId.value = id;
      ctx.selectedKind.value = 'video';
      ctx.loadVideoDialogueFields(id);
      ctx.showVideoDialogue.value = true;
      ctx.closeVideoSubPanels('dialogue');
      ctx.closeVideoGenPromptBar();
      ctx.syncNodeSelectionHighlight(id);
      ctx.updateNodeToolbar();
  };
  
  ctx.toggleVideoDialogue = function toggleVideoDialogue() {
      if (ctx.showVideoDialogue.value) {
          ctx.persistVideoDialogueFields();
          ctx.showVideoDialogue.value = false;
          ctx.activeVideoDialogueNodeId = '';
          ctx.updateNodeToolbar();
          return;
      }
      ctx.openVideoDialogue();
  };
  
  ctx.handleVideoNodeDblClick = function handleVideoNodeDblClick({ node }: {
      node: Node;
  }) {
      const data = node.getData() as CanvasNodeData;
      if (!ctx.canAutoOpenVideoDialogue(data))
          return;
      ctx.openVideoDialogue(node.id);
  };
  
  ctx.toggleVideoHdPanel = function toggleVideoHdPanel() {
      ctx.showVideoHdPanel.value = !ctx.showVideoHdPanel.value;
      if (ctx.showVideoHdPanel.value) {
          ctx.closeVideoSubPanels('hd');
          ctx.updateNodeToolbar();
      }
  };
  
  ctx.toggleVideoFramesPanel = function toggleVideoFramesPanel() {
      ctx.showVideoFramesPanel.value = !ctx.showVideoFramesPanel.value;
      if (ctx.showVideoFramesPanel.value) {
          ctx.closeVideoSubPanels('frames');
          ctx.updateNodeToolbar();
      }
  };
  
  ctx.toggleImageAddToDialogMenu = function toggleImageAddToDialogMenu() {
      const g = ctx.graph.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'image' || !data.previewUrl || data.uploadState === 'uploading')
          return;
      ctx.emit('add-to-chat', {
          previewUrl: data.previewUrl,
          fileName: data.fileName || data.title || 'image.jpg',
          assetId: resolveImageAssetId(data),
          nodeId: id,
      });
  };
  
  ctx.addVideoToDialog = function addVideoToDialog() {
      const g = ctx.graph.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'video' || !data.previewUrl || data.uploadState === 'uploading')
          return;
      ctx.emit('add-to-chat', {
          previewUrl: data.previewUrl,
          fileName: data.fileName || data.title || 'video.jpg',
          assetId: data.assetId || data.sourceAssetId || '',
          nodeId: id,
      });
  };
  
  ctx.resetVideoHdPanel = function resetVideoHdPanel() {
      ctx.showVideoHdPanel.value = false;
  };
  
  ctx.resetVideoFramesPanel = function resetVideoFramesPanel() {
      ctx.showVideoFramesPanel.value = false;
  };
  
  ctx.onVideoHdStart = function onVideoHdStart() {
      const magnification = ctx.videoHdMagnification.value;
      ctx.resetVideoHdPanel();
      ctx.onVideoToolbarAction({
          key: 'VIDEO_HD',
          option: magnification,
          label: '高清补帧',
      });
  };
  
  ctx.resetImageDialogue = function resetImageDialogue() {
      ctx.persistImageDialogueFields();
      ctx.showImageDialogue.value = false;
      ctx.activeImageDialogueNodeId = '';
      ctx.exitImageDialogueCanvasPickMode();
  };
  
  ctx.resetImageDialogueInputOnSourceNode = function resetImageDialogueInputOnSourceNode(sourceNodeId: string) {
      const g = ctx.graph.value;
      if (!g || !sourceNodeId)
          return;
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode())
          return;
      const node = cell as Node;
      const data = { ...(node.getData() as CanvasNodeData) };
      data.imageDialogueText = '';
      data.genPrompt = '';
      data.imageDialogueSettings = createDefaultImageDialogueSettings();
      data.imageSourceRefs = [];
      delete data.sourceNodeId;
      delete data.sourcePreviewUrl;
      delete data.sourceFileName;
      delete data.sourceAssetId;
      data.inputUpdated = false;
      node.setData(data, { overwrite: true });
      const isActiveSource = ctx.activeImageGenPromptNodeId.value === sourceNodeId ||
          ctx.activeImageDialogueNodeId === sourceNodeId ||
          (ctx.showImageDialogue.value && ctx.selectedNodeId.value === sourceNodeId);
      if (isActiveSource) {
          ctx.imageDialogueText.value = '';
          ctx.imageGenPromptText.value = '';
          ctx.imageDialogueSettings.value = createDefaultImageDialogueSettings();
          ctx.clearImageElementMarkSelection();
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.resetSourceImageDialogueAfterSuccess = function resetSourceImageDialogueAfterSuccess(sourceNode: Node, resultNode: Node, result: {
      success: boolean;
  }) {
      if (!result.success || sourceNode.id === resultNode.id)
          return;
      ctx.resetImageDialogueInputOnSourceNode(sourceNode.id);
  };
  
  ctx.getActiveImageDialogueTargetNodeId = function getActiveImageDialogueTargetNodeId() {
      if (ctx.showImageDialogue.value) {
          if (ctx.activeImageDialogueNodeId)
              return ctx.activeImageDialogueNodeId;
          if (ctx.selectedNodeId.value && ctx.selectedKind.value === 'image') {
              return ctx.selectedNodeId.value;
          }
      }
      if (ctx.activeImageGenPromptNodeId.value)
          return ctx.activeImageGenPromptNodeId.value;
      if (ctx.activeImageDialogueNodeId)
          return ctx.activeImageDialogueNodeId;
      return '';
  };
  
  ctx.canNodeHostImageDialogue = function canNodeHostImageDialogue(data: CanvasNodeData, nodeId: string) {
      if (data.kind === 'image')
          return true;
      return data.kind === 'text' && ctx.activeImageGenPromptNodeId.value === nodeId;
  };
  
  ctx.restoreCanvasPickTargetSelection = function restoreCanvasPickTargetSelection() {
      const g = ctx.graph.value;
      if (!g)
          return;
      const targetId = ctx.showImageDialogueCanvasPickMode.value
          ? ctx.getActiveImageDialogueTargetNodeId()
          : ctx.showVideoGenCanvasPickMode.value
              ? ctx.getActiveVideoTargetNodeId()
              : '';
      if (!targetId) {
          g.cleanSelection();
          ctx.syncNodeSelectionHighlight([]);
          ctx.updateImageResizeOverlay();
          return;
      }
      const cell = g.getCellById(targetId);
      if (!cell?.isNode())
          return;
      const targetData = cell.getData() as CanvasNodeData;
      const currentIds = ctx.getGraphSelectedNodeIds();
      if (currentIds.length !== 1 || currentIds[0] !== targetId) {
          ctx.clearEdgeSelection();
          g.cleanSelection();
          g.select(cell);
      }
      ctx.selectedNodeIds.value = [targetId];
      ctx.selectedNodeId.value = targetId;
      ctx.selectedKind.value = targetData.kind;
      ctx.syncNodeSelectionHighlight(targetId);
      ctx.bumpToolbarRevision();
      const overlayRoot = ctx.canvasRef.value;
      if (overlayRoot) {
          const node = cell as Node;
          if (ctx.showImageDialogue.value && targetData.kind === 'image') {
              ctx.dialoguePos.value = getNodeDialoguePosition(g, node, overlayRoot);
          }
          if (ctx.activeVideoGenPromptNodeId.value === targetId) {
              ctx.updateVideoGenPromptBarPosition();
          }
      }
      ctx.updateImageResizeOverlay();
  };
  
  ctx.hasImageDialogueSourceRef = function hasImageDialogueSourceRef(targetNodeId: string, imageNodeId: string, previewUrl: string) {
      const g = ctx.graph.value;
      if (!g || !targetNodeId)
          return false;
      const cell = g.getCellById(targetNodeId);
      if (!cell?.isNode())
          return false;
      const data = cell.getData() as CanvasNodeData;
      const refs = ctx.seedImageDialogueRefs(data, targetNodeId);
      return refs.some((item) => item.nodeId === imageNodeId || item.previewUrl === previewUrl);
  };
  
  ctx.seedImageDialogueRefs = function seedImageDialogueRefs(data: CanvasNodeData, targetNodeId: string): ImageSourceRef[] {
      return ctx.resolveImageDialogueRefs(data, targetNodeId);
  };
  
  ctx.canAutoOpenImageDialogue = function canAutoOpenImageDialogue(data: CanvasNodeData) {
      return canOpenImageDialogueOnNode(data);
  };
  
  ctx.canAutoOpenVideoDialogue = function canAutoOpenVideoDialogue(data: CanvasNodeData) {
      return (data.kind === 'video' &&
          Boolean(data.previewUrl?.trim()) &&
          data.uploadState !== 'uploading' &&
          !isVideoNodeGenerating(data));
  };
  
  ctx.syncImageDialogueSourceRefs = function syncImageDialogueSourceRefs(targetNode: Node, sourceRefs: ImageSourceRef[]) {
      const data = { ...(targetNode.getData() as CanvasNodeData) };
      data.imageSourceRefs = sourceRefs
          .filter((item) => item.previewUrl?.trim())
          .map((item) => ({
          nodeId: item.nodeId,
          assetId: item.assetId,
          previewUrl: item.previewUrl,
          fileName: item.fileName ?? '',
      }));
      data.inputUpdated = data.imageSourceRefs.some((item) => Boolean(item.previewUrl));
      targetNode.setData(data, { overwrite: true });
      const g = ctx.graph.value;
      if (g)
          syncPendingImageTargetFromSources(g, targetNode);
  };
  
  ctx.applyImageDialogueProvenance = function applyImageDialogueProvenance(targetNode: Node, options: {
      prompt: string;
      settings?: ImageDialogueSettings;
      sourceRefs: ImageSourceRef[];
      elementMarks?: ImageMarkItem[];
      generationParams?: CanvasGenerationParams;
  }) {
      const refs = options.sourceRefs
          .map(ctx.enrichImageSourceRefPreview)
          .filter((item) => item.previewUrl?.trim() || item.assetId?.trim())
          .map((item) => ({
          nodeId: item.nodeId,
          assetId: item.assetId,
          previewUrl: item.previewUrl,
          fileName: item.fileName ?? '',
      }));
      const prompt = options.prompt.trim();
      if (options.generationParams) {
          persistNodeGenerationSnapshot(targetNode, {
              ...options.generationParams,
              prompt: options.generationParams.prompt || prompt,
              imageDialogueText: prompt,
              imageDialogueSettings: options.settings,
              imageSourceRefs: refs,
              elementMarks: options.elementMarks?.length
                  ? options.elementMarks.map((mark) => ({ ...mark }))
                  : undefined,
              genPrompt: prompt,
          });
          return;
      }
      const data = { ...(targetNode.getData() as CanvasNodeData) };
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      if (latest) {
          data.sourceNodeId = latest.nodeId;
          data.sourcePreviewUrl = latest.previewUrl;
          data.sourceFileName = latest.fileName;
          data.sourceAssetId = latest.assetId;
      }
      data.inputUpdated = refs.length > 0;
      if (prompt) {
          data.imageDialogueText = prompt;
          data.genPrompt = prompt;
      }
      if (options.settings) {
          data.imageDialogueSettings = { ...options.settings };
      }
      if (options.elementMarks?.length) {
          data.elementMarks = options.elementMarks.map((mark) => ({ ...mark }));
      }
      targetNode.setData(data, { overwrite: true });
  };
  
  ctx.addImageDialogueSourceRef = function addImageDialogueSourceRef(payload: {
      nodeId?: string;
      assetId?: string;
      previewUrl: string;
      fileName?: string;
  }, targetNodeId?: string) {
      const g = ctx.graph.value;
      const id = targetNodeId ?? ctx.selectedNodeId.value;
      if (!g || !id || !payload.previewUrl)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, id))
          return;
      if (payload.nodeId && payload.nodeId === id)
          return;
      const ref: ImageSourceRef = {
          nodeId: payload.nodeId || payload.assetId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          assetId: payload.assetId,
          previewUrl: payload.previewUrl,
          fileName: payload.fileName ?? '',
      };
      let refs = ctx.seedImageDialogueRefs(data, id);
      const existingIdx = payload.nodeId
          ? refs.findIndex((item) => item.nodeId === payload.nodeId)
          : refs.findIndex((item) => item.previewUrl === payload.previewUrl);
      if (existingIdx >= 0) {
          refs.splice(existingIdx, 1, ref);
      }
      else if (!refs.some((item) => item.previewUrl === payload.previewUrl)) {
          refs.push(ref);
      }
      else {
          return;
      }
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      data.sourceNodeId = latest?.nodeId ?? '';
      data.sourcePreviewUrl = latest?.previewUrl ?? '';
      data.sourceFileName = latest?.fileName ?? '';
      data.sourceAssetId = latest?.assetId ?? '';
      data.inputUpdated = refs.some((item) => Boolean(item.previewUrl));
      cell.setData(data, { overwrite: true });
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.linkImageNodeToImageDialogue = async function linkImageNodeToImageDialogue(imageNodeId: string, targetNodeId = ctx.selectedNodeId.value) {
      const g = ctx.graph.value;
      if (!g || !targetNodeId || !imageNodeId || imageNodeId === targetNodeId)
          return false;
      const source = g.getCellById(imageNodeId);
      const target = g.getCellById(targetNodeId);
      if (!source?.isNode() || !target?.isNode())
          return false;
      const sourceData = source.getData() as CanvasNodeData;
      const targetData = target.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' ||
          !ctx.canNodeHostImageDialogue(targetData, targetNodeId) ||
          !sourceData.previewUrl ||
          sourceData.uploadState === 'uploading' ||
          sourceData.imageGenTask === 'picker') {
          return false;
      }
      const hasEdge = g.getEdges().some((edge) => edge.getSourceCellId() === imageNodeId && edge.getTargetCellId() === targetNodeId);
      if (!hasEdge) {
          connectGenEdge(g, imageNodeId, targetNodeId);
      }
      ctx.addImageDialogueSourceRef({
          nodeId: imageNodeId,
          assetId: sourceData.assetId,
          previewUrl: sourceData.previewUrl,
          fileName: sourceData.fileName || sourceData.title || '',
      }, targetNodeId);
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.onImageDialogueUploadFiles = async function onImageDialogueUploadFiles(files: File[]) {
      const g = ctx.graph.value;
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      if (!g || !targetNodeId)
          return;
      const targetCell = g.getCellById(targetNodeId);
      if (!targetCell?.isNode())
          return;
      const targetData = targetCell.getData() as CanvasNodeData;
      if (!ctx.canNodeHostImageDialogue(targetData, targetNodeId))
          return;
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (!imageFiles.length)
          return;
      const wasDialogueOpen = ctx.showImageDialogue.value;
      const bbox = targetCell.getBBox();
      for (let index = 0; index < imageFiles.length; index += 1) {
          const point = {
              x: bbox.x - 200 - index * 48,
              y: bbox.y + index * 36,
          };
          const node = await ctx.addImageFromFile(imageFiles[index], point, { select: false });
          if (!node)
              continue;
          await ctx.linkImageNodeToImageDialogue(node.id, targetNodeId);
      }
      ctx.selectGraphNodes(targetNodeId);
      if (wasDialogueOpen) {
          ctx.openImageDialogue(targetNodeId);
      }
      else {
          ctx.updateNodeToolbar();
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.onImageDialogueAddCanvasNode = function onImageDialogueAddCanvasNode(sourceNodeId: string) {
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      const wasDialogueOpen = ctx.showImageDialogue.value;
      void ctx.linkImageNodeToImageDialogue(sourceNodeId, targetNodeId).then((linked) => {
          if (!linked)
              return;
          if (targetNodeId) {
              ctx.selectGraphNodes(targetNodeId);
              if (wasDialogueOpen) {
                  ctx.openImageDialogue(targetNodeId);
              }
              else {
                  ctx.updateNodeToolbar();
              }
          }
          ctx.bumpToolbarRevision();
          ctx.scheduleHistoryPush();
      });
  };
  
  ctx.appendImageDialogueDigitalHumanRef = function appendImageDialogueDigitalHumanRef(payload: {
      assetId: string;
      previewUrl: string;
  }, targetNodeId?: string): boolean {
      const g = ctx.graph.value;
      const id = targetNodeId ?? ctx.selectedNodeId.value;
      if (!g || !id || !payload.previewUrl?.trim() || !payload.assetId)
          return false;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return false;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, id))
          return false;
      const ref: ImageSourceRef = {
          nodeId: `digital-human-${payload.assetId}`,
          assetId: payload.assetId,
          previewUrl: payload.previewUrl,
          fileName: '我的数字人',
      };
      const refs = Array.isArray(data.imageSourceRefs)
          ? data.imageSourceRefs.filter((item) => item.previewUrl?.trim())
          : [];
      if (refs.some((item) => item.assetId === payload.assetId)) {
          return true;
      }
      data.imageSourceRefs = [...refs, ref];
      data.inputUpdated = data.imageSourceRefs.some((item) => Boolean(item.previewUrl));
      const selfRef = ctx.buildNodeSelfDialogueRef(data, id);
      if (!selfRef) {
          data.sourceNodeId = ref.nodeId;
          data.sourcePreviewUrl = ref.previewUrl;
          data.sourceFileName = ref.fileName;
          data.sourceAssetId = ref.assetId;
      }
      cell.setData(data, { overwrite: true });
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.onImageDialogueAddDigitalHumanRef = function onImageDialogueAddDigitalHumanRef(payload: {
      assetId: string;
      previewUrl: string;
  }) {
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      const appended = ctx.appendImageDialogueDigitalHumanRef(payload, targetNodeId);
      if (!appended)
          return;
      if (ctx.activeImageGenPromptNodeId.value === targetNodeId) {
          ctx.loadImageGenPromptFields(targetNodeId);
      }
      if (ctx.showImageDialogue.value && ctx.getActiveImageDialogueTargetNodeId() === targetNodeId) {
          ctx.loadImageDialogueFields(targetNodeId);
          ctx.persistImageDialogueFields(targetNodeId);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.clearImageDialoguePreview = function clearImageDialoguePreview(sourceNodeId?: string) {
      const g = ctx.graph.value;
      const id = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      let refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : [];
      if (sourceNodeId) {
          const removed = refs.filter((item) => item.nodeId === sourceNodeId);
          removed.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = refs.filter((item) => item.nodeId !== sourceNodeId);
          // 同步删除该来源连入的连线
          g.getEdges().forEach((edge) => {
              if (edge.getSourceCellId() === sourceNodeId && edge.getTargetCellId() === id) {
                  g.removeEdge(edge.id);
              }
          });
      }
      else {
          refs.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = [];
      }
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      data.sourceNodeId = latest?.nodeId ?? '';
      data.sourcePreviewUrl = latest?.previewUrl ?? '';
      data.sourceFileName = latest?.fileName ?? '';
      data.sourceAssetId = latest?.assetId ?? '';
      data.inputUpdated = refs.some((item) => Boolean(item.previewUrl));
      // overwrite: true —— X6 默认深合并数组不会缩短，删除元素必须整体替换
      cell.setData(data, { overwrite: true });
      ctx.toolbarRevision.value += 1;
      ctx.scheduleHistoryPush();
  };
  
  ctx.resetVideoDialogue = function resetVideoDialogue() {
      ctx.persistVideoDialogueFields();
      ctx.showVideoDialogue.value = false;
      ctx.activeVideoDialogueNodeId = '';
  };
  
  ctx.closeTextPromptBar = function closeTextPromptBar() {
      if (!ctx.activePickerNodeId.value)
          return;
      ctx.persistPromptBarDraft();
      ctx.activePickerNodeId.value = '';
      ctx.bumpToolbarRevision();
  };
  
  ctx.closeNodeDialoguePanels = function closeNodeDialoguePanels() {
      if (ctx.showImageDialogue.value)
          ctx.resetImageDialogue();
      if (ctx.showVideoDialogue.value)
          ctx.resetVideoDialogue();
      ctx.closeTextPromptBar();
  };
  
  ctx.triggerFileInputClick = function triggerFileInputClick(accept: string, filter: UploadFilter, multiple: boolean, nodeId = '') {
      const now = Date.now();
      if (now - ctx.lastCanvasFileInputClickAt < ctx.CANVAS_FILE_INPUT_CLICK_DEBOUNCE_MS)
          return;
      ctx.lastCanvasFileInputClickAt = now;
      ctx.pendingUploadNodeId.value = nodeId;
      ctx.fileInputAccept.value = accept;
      ctx.fileInputMultiple.value = multiple;
      ctx.pendingUploadFilter.value = filter;
      const input = ctx.fileInputRef.value;
      if (!input)
          return;
      // 同步写入 DOM，避免首次点击时 :accept 尚未更新导致文件类型无限制
      input.value = '';
      input.accept = accept;
      input.multiple = multiple;
      input.click();
  };
}
