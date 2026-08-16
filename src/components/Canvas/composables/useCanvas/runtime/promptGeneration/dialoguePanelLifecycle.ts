// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装图片/视频对话框 open/toggle/dblclick、HD/frames 面板与 resets/close 到 ctx。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { canOpenImageDialogueOnNode,createDefaultImageDialogueSettings,isPendingImageGenDialogueTarget,isVideoNodeGenerating,resolveGenerationTaskWorkflowId,resolveImageAssetId,type CanvasGenerationParams,type ImageDialogueSettings,type ImageMarkItem,type ImageToolbarClickEvent } from '../../../../constants';
import { buildImageGenerationParams,cloneNodeGenerationSnapshot,persistNodeGenerationSnapshot } from '../../../../generationParams';
import { applyGenerationResultToNode,bindGenerationTaskId,bindSharedGenerationTaskId,markGenerationNodeFailed,pickImageGenerationResults,readGenerationResultIndex,resolveGenerationResultPreview,startImageGenerationOnNode,type GenerationTaskDetail,type GenerationTaskResult } from '../../../../generationTask';
import { syncNodeImageMarkLists } from '../../../../imageMarkUtils';
import { downloadCanvasMedia } from '../../../../mediaDownload';
import type { CanvasNodeData,ImageSourceRef } from '../../sharedImports';
import { api,connectGenEdge,getImageGenerationPlaceholderSize,getNodeDialoguePosition,getScroller,isVideoGenerationFailedNode,planOutgoingResultPoints,spawnCompletedImageResultNode,spawnCroppedImageNode,spawnGenerationResultNode,syncPendingImageTargetFromSources } from '../../sharedImports';
import type { UploadFilter } from '../../state';
import type { CoreRuntimeContext } from '../context';
export function installPromptDialoguePanelLifecycle(ctx: CoreRuntimeContext) {
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

  ctx.canAutoOpenImageDialogue = function canAutoOpenImageDialogue(data: CanvasNodeData) {
      return canOpenImageDialogueOnNode(data);
  };
  
  ctx.canAutoOpenVideoDialogue = function canAutoOpenVideoDialogue(data: CanvasNodeData) {
      return (data.kind === 'video' &&
          Boolean(data.previewUrl?.trim()) &&
          data.uploadState !== 'uploading' &&
          !isVideoNodeGenerating(data));
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
}
