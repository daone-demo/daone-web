// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 ImageMarking 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { Project } from '@/stores/useProject';
import type { Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { computed,provide } from 'vue';
import { isNavigationFailure,NavigationFailureType } from 'vue-router';
import { isPendingImageGenDialogueTarget,isVideoNodeGenerating,resolveImageAssetId,type ImageMarkItem } from '../../../constants';
import { recoverOrphanedGenerationTasks,resumePendingGenerationTasks } from '../../../generationTask';
import { clearElementMarksOnNode,collectDialogueElementMarks,removeImageMarkFromGraph,stripMarkMentionFromPrompt } from '../../../imageMarkUtils';
import type { CanvasGraph,CanvasNodeData,ImageGenTask } from '.././sharedImports';
import { api,applyImageGenTaskToNode,CANVAS_MAX_ZOOM,CANVAS_MIN_ZOOM,clientPointToGraphLocal,findImageToVideoEdge,getVideoSourceRefs,ZOOM_MENU_PRESETS } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installImageMarking(ctx: CoreRuntimeContext) {
  ctx.syncImageElementMarkSelection = function syncImageElementMarkSelection(sourceNodeId: string, markId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      g.getNodes().forEach((cell) => {
          if (!cell.isNode())
              return;
          const node = cell as Node;
          const nodeData = node.getData() as CanvasNodeData;
          const nextId = node.id === sourceNodeId && markId ? markId : undefined;
          if ((nodeData.selectedImageElementMarkId ?? '') === (nextId ?? ''))
              return;
          node.setData({ ...nodeData, selectedImageElementMarkId: nextId }, { overwrite: true });
      });
  };
  
  ctx.clearImageElementMarkSelection = function clearImageElementMarkSelection() {
      ctx.selectedElementMarkId.value = '';
      const g = ctx.graph.value;
      if (!g)
          return;
      g.getNodes().forEach((cell) => {
          if (!cell.isNode())
              return;
          const node = cell as Node;
          const nodeData = node.getData() as CanvasNodeData;
          if (!nodeData.selectedImageElementMarkId)
              return;
          node.setData({ ...nodeData, selectedImageElementMarkId: undefined }, { overwrite: true });
      });
  };
  
  ctx.selectElementMark = function selectElementMark(markId: string) {
      const mark = ctx.findElementMarkById(markId);
      if (!mark || mark.pending)
          return;
      ctx.selectedElementMarkId.value = markId;
      ctx.syncImageElementMarkSelection(mark.sourceNodeId, markId);
      ctx.bumpToolbarRevision();
  };
  
  ctx.removeSelectedElementMark = function removeSelectedElementMark(): boolean {
      const markId = ctx.selectedElementMarkId.value;
      if (!markId)
          return false;
      const mark = ctx.findElementMarkById(markId);
      if (!mark || mark.pending) {
          ctx.clearImageElementMarkSelection();
          return false;
      }
      ctx.removeElementMark(markId);
      return true;
  };
  
  ctx.removeElementMark = function removeElementMark(markId: string) {
      const g = ctx.graph.value;
      if (!g || !markId)
          return;
      const mark = ctx.findElementMarkById(markId);
      // 无论标记挂在 elementMarks 还是 imageElementMarks，都按 id 全图移除，保证图上钉点与对话框同步
      const removed = removeImageMarkFromGraph(g, markId);
      if (!removed && !mark)
          return;
      const ownerId = ctx.getElementMarkOwnerNodeId();
      if (mark && (ctx.showImageDialogue.value || ctx.activeImageGenPromptNodeId.value)) {
          ctx.imageDialogueText.value = stripMarkMentionFromPrompt(ctx.imageDialogueText.value, mark);
          if (ownerId)
              ctx.persistImageDialogueFields(ownerId);
      }
      if (mark && ctx.showVideoGenPromptBar.value) {
          ctx.videoGenPromptText.value = stripMarkMentionFromPrompt(ctx.videoGenPromptText.value, mark);
          ctx.persistVideoGenPrompt();
      }
      if (ctx.selectedElementMarkId.value === markId) {
          ctx.clearImageElementMarkSelection();
      }
      else {
          // 即便未走选中态，也清掉节点上残留的选中 id（removeImageMarkFromNode 已处理，这里兜底全局）
          const stillSelected = g.getNodes().some((cell) => {
              const data = cell.getData() as CanvasNodeData;
              return data.selectedImageElementMarkId === markId;
          });
          if (stillSelected)
              ctx.clearImageElementMarkSelection();
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.clearElementMarks = function clearElementMarks() {
      const g = ctx.graph.value;
      const ownerId = ctx.getElementMarkOwnerNodeId();
      if (!g || !ownerId)
          return;
      const cell = g.getCellById(ownerId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      const markMap = new Map<string, ImageMarkItem>();
      for (const mark of collectDialogueElementMarks(data)) {
          markMap.set(mark.id, mark);
      }
      const marks = [...markMap.values()];
      if (!marks.length)
          return;
      marks.forEach((mark) => removeImageMarkFromGraph(g, mark.id));
      clearElementMarksOnNode(cell as Node);
      // 同步清空本节点图片钉（clearElementMarksOnNode 只清 elementMarks）
      const latest = { ...(cell.getData() as CanvasNodeData) };
      if (latest.imageElementMarks?.length) {
          latest.imageElementMarks = [];
          delete latest.selectedImageElementMarkId;
          cell.setData(latest, { overwrite: true });
      }
      ctx.clearImageElementMarkSelection();
      if (ctx.showImageDialogue.value) {
          let text = ctx.imageDialogueText.value;
          marks.forEach((mark) => {
              text = stripMarkMentionFromPrompt(text, mark);
          });
          ctx.imageDialogueText.value = text;
          ctx.persistImageDialogueFields(ownerId);
      }
      if (ctx.showVideoGenPromptBar.value) {
          let text = ctx.videoGenPromptText.value;
          marks.forEach((mark) => {
              text = stripMarkMentionFromPrompt(text, mark);
          });
          ctx.videoGenPromptText.value = text;
          ctx.persistVideoGenPrompt();
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.resolveElementMarkPreviewUrl = function resolveElementMarkPreviewUrl(mark: ImageMarkItem) {
      const g = ctx.graph.value;
      if (!g)
          return '';
      const cell = g.getCellById(mark.sourceNodeId);
      if (!cell?.isNode())
          return '';
      const data = cell.getData() as CanvasNodeData;
      return data.previewUrl?.trim() || '';
  };
  
  ctx.handleImageAnnotateAction = function handleImageAnnotateAction() {
      const id = ctx.selectedNodeId.value;
      if (!id)
          return;
      const data = ctx.getSelectedNodeData();
      if (data?.kind !== 'image' || !data.previewUrl) {
          message.warning('请先选择一张图片');
          return;
      }
      if (ctx.showElementSelectMode.value && ctx.elementSelectContext.value === 'image-dialogue') {
          ctx.exitElementSelectMode({ force: true });
          return;
      }
      if (!ctx.showImageDialogue.value || ctx.getActiveImageDialogueTargetNodeId() !== id) {
          ctx.openImageDialogue(id);
      }
      ctx.enterElementSelectMode('image-dialogue', { coordinateOnly: true });
  };
  
  ctx.toggleImageDialogueMarkMode = function toggleImageDialogueMarkMode(options?: {
      coordinateOnly?: boolean;
  }) {
      if (ctx.showElementSelectMode.value && ctx.elementSelectContext.value === 'image-dialogue') {
          ctx.exitElementSelectMode({ force: true });
          return;
      }
      const targetId = ctx.getActiveImageDialogueTargetNodeId();
      if (!targetId)
          return;
      const data = ctx.graph.value?.getCellById(targetId)?.getData() as CanvasNodeData | undefined;
      if (isPendingImageGenDialogueTarget(data))
          return;
      ctx.enterElementSelectMode('image-dialogue', {
          coordinateOnly: options?.coordinateOnly !== false,
      });
  };
  
  ctx.enterVideoGenCanvasPickMode = function enterVideoGenCanvasPickMode() {
      ctx.exitElementSelectMode({ force: true });
      ctx.exitImageDialogueCanvasPickMode();
      ctx.showVideoGenCanvasPickMode.value = true;
  };
  
  ctx.exitVideoGenCanvasPickMode = function exitVideoGenCanvasPickMode() {
      ctx.showVideoGenCanvasPickMode.value = false;
  };
  
  ctx.toggleVideoGenCanvasPickMode = function toggleVideoGenCanvasPickMode() {
      if (ctx.showVideoGenCanvasPickMode.value) {
          ctx.exitVideoGenCanvasPickMode();
          return;
      }
      ctx.enterVideoGenCanvasPickMode();
  };
  
  ctx.enterImageDialogueCanvasPickMode = function enterImageDialogueCanvasPickMode() {
      ctx.exitElementSelectMode({ force: true });
      ctx.exitVideoGenCanvasPickMode();
      const targetId = ctx.getActiveImageDialogueTargetNodeId();
      if (!targetId)
          return;
      if (!ctx.activeImageDialogueNodeId) {
          ctx.activeImageDialogueNodeId = targetId;
      }
      ctx.showImageDialogueCanvasPickMode.value = true;
  };
  
  ctx.exitImageDialogueCanvasPickMode = function exitImageDialogueCanvasPickMode() {
      ctx.showImageDialogueCanvasPickMode.value = false;
  };
  
  ctx.toggleImageDialogueCanvasPickMode = function toggleImageDialogueCanvasPickMode() {
      if (ctx.showImageDialogueCanvasPickMode.value) {
          ctx.exitImageDialogueCanvasPickMode();
          return;
      }
      if (!ctx.getActiveImageDialogueTargetNodeId())
          return;
      ctx.enterImageDialogueCanvasPickMode();
  };
  
  ctx.handleImageDialogueCanvasPick = async function handleImageDialogueCanvasPick(nodeId: string) {
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId();
      if (!targetNodeId || !nodeId || nodeId === targetNodeId)
          return;
      const g = ctx.graph.value;
      if (!g)
          return;
      const source = g.getCellById(nodeId);
      if (!source?.isNode())
          return;
      const sourceData = source.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' ||
          !sourceData.previewUrl ||
          sourceData.uploadState === 'uploading' ||
          sourceData.imageGenTask === 'picker') {
          return;
      }
      if (ctx.hasImageDialogueSourceRef(targetNodeId, nodeId, sourceData.previewUrl)) {
          message.info('该图片已添加');
          return;
      }
      const linked = await ctx.linkImageNodeToImageDialogue(nodeId, targetNodeId);
      if (linked) {
          message.success('已添加参考图');
          ctx.bumpToolbarRevision();
          ctx.restoreCanvasPickTargetSelection();
      }
  };
  
  ctx.handleVideoGenCanvasPick = async function handleVideoGenCanvasPick(nodeId: string) {
      const g = ctx.graph.value;
      const videoNodeId = ctx.getActiveVideoTargetNodeId();
      if (!g || !videoNodeId || !nodeId || nodeId === videoNodeId)
          return;
      const source = g.getCellById(nodeId);
      if (!source?.isNode())
          return;
      const sourceData = source.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' ||
          !sourceData.previewUrl ||
          sourceData.uploadState === 'uploading' ||
          sourceData.imageGenTask === 'picker') {
          return;
      }
      if (findImageToVideoEdge(g, nodeId, videoNodeId)) {
          message.info('该图片已添加');
          return;
      }
      const currentCount = getVideoSourceRefs(g, videoNodeId).length;
      if (currentCount >= ctx.getVideoGenSourceLimit()) {
          message.warning('参考图数量已达上限');
          return;
      }
      const linked = await ctx.linkImageNodeToVideoGen(nodeId);
      if (linked) {
          message.success('已添加参考图');
          ctx.bumpToolbarRevision();
          ctx.restoreCanvasPickTargetSelection();
      }
  };
  
  ctx.returnFromElementSelect = function returnFromElementSelect() {
      const returnId = ctx.elementSelectReturnNodeId.value;
      const context = ctx.elementSelectContext.value;
      ctx.exitElementSelectMode({ force: true });
      if (!returnId)
          return;
      const g = ctx.graph.value;
      const cell = g?.getCellById(returnId);
      if (!cell?.isNode())
          return;
      ctx.selectedNodeId.value = returnId;
      if (context === 'image-dialogue') {
          ctx.selectedKind.value = 'image';
          ctx.syncNodeSelectionHighlight(returnId);
          ctx.openImageDialogue(returnId);
          ctx.updateNodeToolbar();
          return;
      }
      ctx.selectedKind.value = 'video';
      ctx.syncNodeSelectionHighlight(returnId);
      ctx.openVideoGenPromptBar(returnId, ctx.videoGenActiveTab.value);
      ctx.updateNodeToolbar();
  };
  
  ctx.onVideoGenQuickAction = function onVideoGenQuickAction(key: string) {
      if (key === 'mark') {
          if (ctx.showElementSelectMode.value && ctx.elementSelectContext.value === 'video-gen') {
              ctx.exitElementSelectMode({ force: true });
              return;
          }
          ctx.enterElementSelectMode('video-gen', { coordinateOnly: true });
      }
  };
  
  ctx.openImageGenPromptBar = function openImageGenPromptBar(nodeId: string) {
      ctx.closeVideoGenPromptBar();
      ctx.closeTextPromptBar();
      if (ctx.activeImageGenPromptNodeId.value && ctx.activeImageGenPromptNodeId.value !== nodeId) {
          ctx.persistImageGenPrompt();
          ctx.persistImageDialogueFields(ctx.activeImageGenPromptNodeId.value);
      }
      const g = ctx.graph.value;
      if (g) {
          const cell = g.getCellById(nodeId);
          if (cell?.isNode()) {
              const data = { ...(cell.getData() as CanvasNodeData) };
              if (data.kind === 'image' && data.imageGenTask === 'img2img') {
                  data.imageGenTask = 'picker';
                  data.mode = 'picker';
                  cell.setData(data);
              }
          }
      }
      ctx.activeImageGenPromptNodeId.value = nodeId;
      ctx.loadImageGenPromptFields(nodeId);
      ctx.updateImageGenPromptBarPosition();
  };
  
  ctx.closeImageGenPromptBar = function closeImageGenPromptBar() {
      ctx.activeImageGenPromptNodeId.value = '';
  };
  
  ctx.handleApplyImageGenTask = function handleApplyImageGenTask(nodeId: string, task: ImageGenTask) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      ctx.selectedNodeId.value = nodeId;
      if (task === 'img2img') {
          ctx.openImageGenPromptBar(nodeId);
          ctx.updateNodeToolbar();
          return;
      }
      applyImageGenTaskToNode(cell as Node, task);
      ctx.closeImageGenPromptBar();
      ctx.updateNodeToolbar();
  };
  
  provide('applyImageGenTask', ctx.handleApplyImageGenTask);
  
  ctx.handleOpenVideoGenPromptBar = function handleOpenVideoGenPromptBar(nodeId: string, tab?: string) {
      ctx.selectedNodeId.value = nodeId;
      ctx.openVideoGenPromptBar(nodeId, tab ?? 'text2video');
      ctx.syncNodeSelectionHighlight(nodeId);
      ctx.updateNodeToolbar();
  };
  
  provide('openVideoGenPromptBar', ctx.handleOpenVideoGenPromptBar);
  
  ctx.removeConnectPreviewEdge = function removeConnectPreviewEdge() {
      const g = ctx.graph.value as CanvasGraph | null;
      if (!g?.__connectPreviewEdgeId)
          return;
      const edge = g.getCellById(g.__connectPreviewEdgeId);
      if (edge?.isEdge())
          g.removeEdge(edge);
      g.__connectPreviewEdgeId = '';
  };
  
  ctx.syncConnectPreviewEdgeTarget = function syncConnectPreviewEdgeTarget() {
      const g = ctx.graph.value as CanvasGraph | null;
      if (!g?.__connectPreviewEdgeId || !ctx.canvasRef.value)
          return;
      const edge = g.getCellById(g.__connectPreviewEdgeId);
      if (!edge?.isEdge())
          return;
      const rect = ctx.canvasRef.value.getBoundingClientRect();
      const clientX = rect.left + ctx.connectMenuPos.value.left;
      const clientY = rect.top + ctx.connectMenuPos.value.top;
      edge.setTarget(g.clientToLocal(clientX, clientY));
  };
  
  ctx.setConnectSourceNodeMetaHidden = function setConnectSourceNodeMetaHidden(hidden: boolean) {
      const g = ctx.graph.value;
      const sourceId = ctx.connectSourceNodeId.value;
      if (!g || !sourceId)
          return;
      const cell = g.getCellById(sourceId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (Boolean(data.hideNodeMeta) === hidden)
          return;
      cell.setData({ ...data, hideNodeMeta: hidden });
  };
  
  ctx.closeConnectMenu = function closeConnectMenu() {
      ctx.setConnectSourceNodeMetaHidden(false);
      ctx.removeConnectPreviewEdge();
      ctx.showConnectMenu.value = false;
      ctx.connectSourceNodeId.value = '';
      ctx.connectReleasePoint.value = null;
  };
  
  ctx.closeImageContextMenu = function closeImageContextMenu() {
      ctx.showImageContextMenu.value = false;
      ctx.imageContextMenuNodeId.value = '';
      ctx.imageContextMenuKind.value = 'image';
  };
  
  ctx.canOpenVideoContextMenu = function canOpenVideoContextMenu(data: CanvasNodeData) {
      return (data.kind === 'video' &&
          Boolean(data.previewUrl?.trim()) &&
          data.uploadState !== 'uploading' &&
          !isVideoNodeGenerating(data));
  };
  
  ctx.canOpenImageContextMenu = function canOpenImageContextMenu(data: CanvasNodeData) {
      return (data.kind === 'image' &&
          Boolean(data.previewUrl?.trim()) &&
          data.uploadState !== 'uploading' &&
          !data.compactPreview &&
          !data.gridSplitTile);
  };
  
  ctx.canOpenMediaContextMenu = function canOpenMediaContextMenu(data: CanvasNodeData) {
      return ctx.canOpenImageContextMenu(data) || ctx.canOpenVideoContextMenu(data);
  };
  
  ctx.findMediaNodeAtClientPoint = function findMediaNodeAtClientPoint(clientX: number, clientY: number) {
      const g = ctx.graph.value;
      if (!g)
          return null;
      const local = clientPointToGraphLocal(g, clientX, clientY);
      const candidates = g
          .getNodes()
          .filter((node) => ctx.canOpenMediaContextMenu(node.getData() as CanvasNodeData))
          .sort((a, b) => (b.getZIndex() ?? 0) - (a.getZIndex() ?? 0));
      return (candidates.find((node) => {
          const bbox = node.getBBox();
          return (local.x >= bbox.x &&
              local.x <= bbox.x + bbox.width &&
              local.y >= bbox.y &&
              local.y <= bbox.y + bbox.height);
      }) ?? null);
  };
  
  ctx.handleMediaNodeContextMenu = function handleMediaNodeContextMenu(nodeId: string, clientX: number, clientY: number, event?: MouseEvent) {
      event?.preventDefault();
      event?.stopPropagation();
      ctx.openMediaContextMenu(nodeId, clientX, clientY);
  };
  
  ctx.onCanvasImageContextMenuCapture = function onCanvasImageContextMenuCapture(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.canvas__image-context-menu'))
          return;
      const node = ctx.findMediaNodeAtClientPoint(event.clientX, event.clientY);
      if (!node)
          return;
      ctx.handleMediaNodeContextMenu(node.id, event.clientX, event.clientY, event);
  };
  
  ctx.positionImageContextMenu = function positionImageContextMenu(clientX: number, clientY: number) {
      const overlayRoot = ctx.canvasRef.value;
      if (!overlayRoot)
          return { left: 0, top: 0 };
      const rect = overlayRoot.getBoundingClientRect();
      const menuWidth = 188;
      const menuHeight = 420;
      return {
          left: Math.max(12, Math.min(clientX - rect.left, rect.width - menuWidth - 12)),
          top: Math.max(60, Math.min(clientY - rect.top, rect.height - menuHeight - 12)),
      };
  };
  
  ctx.openMediaContextMenu = function openMediaContextMenu(nodeId: string, clientX: number, clientY: number) {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !overlayRoot)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (!ctx.canOpenMediaContextMenu(data))
          return;
      ctx.closeConnectMenu();
      ctx.closeAddMenu();
      ctx.closeImageContextMenu();
      ctx.selectGraphNodes(cell as Node);
      ctx.imageContextMenuNodeId.value = nodeId;
      ctx.imageContextMenuKind.value = data.kind === 'video' ? 'video' : 'image';
      ctx.imageContextMenuPos.value = ctx.positionImageContextMenu(clientX, clientY);
      ctx.showImageContextMenu.value = true;
      (g as CanvasGraph).__suppressBlankCloseForConnect = true;
      window.setTimeout(() => {
          ;
          (g as CanvasGraph).__suppressBlankCloseForConnect = false;
      }, 100);
  };
  
  ctx.imageContextMenuLocked = computed(() => {
      const g = ctx.graph.value;
      const id = ctx.imageContextMenuNodeId.value;
      if (!g || !id)
          return false;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return false;
      return Boolean((cell.getData() as CanvasNodeData).nodeLocked);
  });
  
  ctx.toggleImageNodeLock = function toggleImageNodeLock(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      const nextLocked = !data.nodeLocked;
      cell.setData({ ...data, nodeLocked: nextLocked });
      cell.prop('movable', !nextLocked);
      message.success(nextLocked ? '已锁定节点' : '已解锁节点');
      ctx.scheduleHistoryPush();
  };
  
  ctx.onImageContextMenuAction = function onImageContextMenuAction(key: string) {
      const nodeId = ctx.imageContextMenuNodeId.value;
      const menuKind = ctx.imageContextMenuKind.value;
      ctx.closeImageContextMenu();
      if (!nodeId)
          return;
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      if (ctx.selectedNodeId.value !== nodeId) {
          ctx.selectGraphNodes(cell as Node);
      }
      if (menuKind === 'video') {
          switch (key) {
              case 'chat':
                  ctx.openVideoDialogue(nodeId);
                  return;
              case 'send-agent':
                  ctx.addVideoToDialog();
                  return;
              case 'preview':
                  ctx.openMediaPreview();
                  return;
              case 'download':
                  ctx.onVideoToolbarAction({ key: 'download', label: '下载' });
                  return;
              case 'copy-video':
              case 'copy-image':
                  ctx.duplicateSelectedNodes();
                  return;
              case 'save':
                  ctx.showAssetsPanel.value = true;
                  return;
              case 'delete':
                  ctx.removeNodeById(nodeId);
                  return;
              default:
                  break;
          }
          return;
      }
      switch (key) {
          case 'layer-front':
              ctx.moveNodeLayer('front');
              return;
          case 'layer-back':
              ctx.moveNodeLayer('back');
              return;
          case 'data-advisor':
              ctx.openImageDialogue(nodeId);
              return;
          case 'parse':
              ctx.onImageToolbarAction({ key: 'IMAGE_PROMPT_REVERSE', label: '解析' });
              return;
          case 'chat':
              ctx.openImageDialogue(nodeId);
              return;
          case 'send-agent':
              ctx.toggleImageAddToDialogMenu();
              return;
          case 'send-model':
              void ctx.addImageToMyModels(nodeId);
              return;
          case 'preview':
              ctx.openMediaPreview();
              return;
          case 'download':
              ctx.onImageToolbarAction({ key: 'download', label: '下载' });
              return;
          case 'lock':
              ctx.toggleImageNodeLock(nodeId);
              return;
          case 'copy-image':
          case 'copy-video':
              ctx.duplicateSelectedNodes();
              return;
          case 'save':
              ctx.showAssetsPanel.value = true;
              return;
          case 'delete':
              ctx.removeNodeById(nodeId);
              return;
          default:
              break;
      }
  };
  
  ctx.addImageToMyModels = async function addImageToMyModels(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const assetId = resolveImageAssetId(cell.getData() as CanvasNodeData);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      try {
          await api.createDigitalHuman({ assetId: Number(assetId) || assetId });
          message.success('已添加到我的模特');
      }
      catch (error) {
          console.error('[send-model] createDigitalHuman failed', error);
          message.error('添加到我的模特失败，请稍后重试');
      }
  };
  
  ctx.closeAddMenu = function closeAddMenu() {
      ctx.showAddMenu.value = false;
      ctx.addMenuDropPoint.value = null;
  };
  
  ctx.toggleProjectMenu = function toggleProjectMenu() {
      ctx.showProjectMenu.value = !ctx.showProjectMenu.value;
  };
  
  ctx.closeProjectMenu = function closeProjectMenu() {
      ctx.showProjectMenu.value = false;
  };
  
  ctx.openProjectBrowser = function openProjectBrowser() {
      ctx.closeProjectMenu();
      ctx.closeUserMenu();
      ctx.closeZoomMenu();
      ctx.closeAddMenu();
      ctx.closeConnectMenu();
      ctx.closeShortcutsPanel();
      ctx.showProjectBrowser.value = true;
  };
  
  ctx.closeProjectBrowser = function closeProjectBrowser() {
      ctx.showProjectBrowser.value = false;
  };
  
  ctx.closeZoomMenu = function closeZoomMenu() {
      ctx.showZoomMenu.value = false;
  };
  
  ctx.toggleZoomMenu = function toggleZoomMenu() {
      ctx.showZoomMenu.value = !ctx.showZoomMenu.value;
  };
  
  ctx.applyZoomAfterChange = function applyZoomAfterChange() {
      ctx.syncZoom();
      ctx.updateNodeToolbar();
  };
  
  ctx.zoomToScale = function zoomToScale(scale: number) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const clamped = Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, scale));
      g.zoomTo(clamped);
      ctx.applyZoomAfterChange();
  };
  
  ctx.zoomFitToScreen = function zoomFitToScreen() {
      const g = ctx.graph.value;
      if (!g)
          return;
      g.zoomToFit({
          padding: 48,
          maxScale: CANVAS_MAX_ZOOM,
          minScale: CANVAS_MIN_ZOOM,
      });
      ctx.applyZoomAfterChange();
  };
  
  ctx.onZoomMenuAction = function onZoomMenuAction(action: 'in' | 'out' | 'fit' | 'preset', preset?: (typeof ZOOM_MENU_PRESETS)[number]) {
      if (action === 'in')
          ctx.zoomIn();
      else if (action === 'out')
          ctx.zoomOut();
      else if (action === 'fit')
          ctx.zoomFitToScreen();
      else if (preset != null)
          ctx.zoomToScale(preset);
      ctx.closeZoomMenu();
  };
  
  ctx.selectProject = async function selectProject(projectId: string) {
      ctx.closeProjectBrowser();
      if (projectId === ctx.activeProjectId.value) {
          ctx.closeProjectMenu();
          return;
      }
      const currentRoute = ctx.router.currentRoute.value;
      if (currentRoute.params.id === projectId) {
          ctx.activeProjectId.value = projectId;
          ctx.closeProjectMenu();
          return;
      }
      try {
          await ctx.router.replace({
              name: currentRoute.name ?? undefined,
              params: { ...currentRoute.params, id: projectId },
          });
          ctx.activeProjectId.value = projectId;
          ctx.closeProjectMenu();
      }
      catch (error) {
          if (isNavigationFailure(error, NavigationFailureType.aborted))
              return;
          console.error('[Canvas] switch project failed', error);
      }
  };
  
  ctx.onLoadProjects = async function onLoadProjects() {
      try {
          const res = await api.getProjects<Project>({
              page: 1,
              pageSize: 10,
          });
          ctx.canvasProjects.value = res.records;
      }
      catch (error) {
          console.error('[Canvas] load projects failed', error);
      }
  };
  
  ctx.upsertCanvasProject = function upsertCanvasProject(id: string, title: string, saved = true) {
      const normalizedId = String(id ?? '').trim();
      if (!normalizedId)
          return;
      const item = ctx.canvasProjects.value.find((project) => String(project.id) === normalizedId);
      if (item) {
          item.title = title;
          item.saved = saved;
          return;
      }
      const now = new Date().toISOString();
      ctx.canvasProjects.value.unshift({
          id: normalizedId,
          title,
          saved,
          createdAt: now,
          updatedAt: now,
      });
  };
  
  ctx.resumeCanvasGenerationTasks = function resumeCanvasGenerationTasks() {
      const g = ctx.graph.value;
      if (!g)
          return;
      const resumeOptions = {
          toHtml: ctx.plainTextToEditorHtml,
          onError: (reason: string) => message.error(reason),
          onTaskBound: () => ctx.persistGenerationTaskBinding(),
          onTaskComplete: () => ctx.persistGenerationTaskBinding(),
          onVideoGenerationComplete: (nodeId: string, success: boolean) => {
              if (!success)
                  ctx.revealVideoDialogueAfterGenerationFailure(nodeId);
          },
      };
      void (async () => {
          const projectId = ctx.activeProjectId.value;
          if (projectId) {
              await recoverOrphanedGenerationTasks(g, projectId, {
                  onTaskBound: resumeOptions.onTaskBound,
              });
          }
          await resumePendingGenerationTasks(g, resumeOptions);
      })();
  };
}
