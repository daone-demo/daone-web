// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装画布交互关闭层、节点点击、数据变更与历史元数据相关动作到 ctx。
 */
import type { Node } from '@antv/x6';
import type { CanvasGraph,CanvasNodeData } from '../../sharedImports';
import { getScroller,shouldOpenImageGenPromptBar } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installAssetCanvasInteraction(ctx: CoreRuntimeContext) {
  ctx.resetCanvasPanCursorState = function resetCanvasPanCursorState() {
      ctx.endSpacePan();
      const g = ctx.graph.value;
      if (!g)
          return;
      const scroller = getScroller(g);
      const impl = scroller
          ? (scroller as unknown as {
              scrollerImpl?: {
                  container?: HTMLElement;
                  stopPanning?: () => void;
              };
          }).scrollerImpl
          : null;
      if (!impl?.container)
          return;
      try {
          impl.stopPanning?.();
      }
      catch {
          // 已结束或未开始时忽略
      }
      if (ctx.panMode.value) {
          impl.container.dataset.panning = 'false';
          return;
      }
      delete impl.container.dataset.panning;
      scroller?.disablePanning();
  };
  
  ctx.handleBlankDblClick = function handleBlankDblClick(event: {
      x: number;
      y: number;
  }) {
      ctx.resetCanvasPanCursorState();
      ctx.openAddMenuAtGraphPoint({ x: event.x, y: event.y });
  };
  
  ctx.handleNodeClick = function handleNodeClick({ node, e }: {
      node: Node;
      e?: MouseEvent;
  }) {
      if (ctx.showConnectMenu.value) {
          ctx.closeConnectMenu();
      }
      ctx.setTextEditorToolbarActive(false);
      let data = node.getData() as CanvasNodeData;
      if (data.kind === 'video' && data.previewUrl && data.mode === 'picker') {
          data = { ...data, mode: 'editor' };
          node.setData(data);
      }
      const multiSelect = Boolean(e?.ctrlKey || e?.metaKey);
      if (!multiSelect &&
          (ctx.showVideoGenCanvasPickMode.value || ctx.showImageDialogueCanvasPickMode.value)) {
          ctx.clearEdgeSelection();
          if (data.kind === 'image' && data.previewUrl) {
              if (ctx.showVideoGenCanvasPickMode.value) {
                  void ctx.handleVideoGenCanvasPick(node.id);
              }
              else {
                  void ctx.handleImageDialogueCanvasPick(node.id);
              }
          }
          else {
              ctx.restoreCanvasPickTargetSelection();
          }
          return;
      }
      if (!multiSelect &&
          ctx.showElementSelectMode.value &&
          data.kind === 'image' &&
          data.previewUrl &&
          e) {
          if (e.target instanceof Element && e.target.closest('.image-node__mark-pin-interactive')) {
              return;
          }
          ctx.clearImageElementMarkSelection();
          ctx.clearEdgeSelection();
          // 标记模式下点击其他图片只用于加点；对话框与选中态保持在发起标记的节点，
          // 避免「识别中」等标记状态被带到另一张图的对话框。
          const returnId = ctx.elementSelectReturnNodeId.value;
          const g = ctx.graph.value;
          if (returnId && g) {
              const returnCell = g.getCellById(returnId);
              if (returnCell?.isNode()) {
                  ctx.selectedNodeId.value = returnId;
                  ctx.selectedKind.value = 'image';
                  ctx.selectedNodeIds.value = [returnId];
                  g.cleanSelection();
                  g.select(returnCell);
                  ctx.syncNodeSelectionHighlight([returnId]);
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
              }
          }
          void ctx.handleImageMarkRecognize(node, e);
          return;
      }
      ctx.clearEdgeSelection();
      if (!multiSelect) {
          ctx.selectSingleGraphNode(node);
      }
      ctx.selectedNodeId.value = node.id;
      ctx.selectedKind.value = data.kind;
      if (multiSelect) {
          ctx.cancelVideoToolbarDefer();
          ctx.syncSelectionFromGraph();
          return;
      }
      ctx.cancelVideoToolbarDefer();
      ctx.resetImageToolbarMore();
      ctx.resetImageCrop();
      ctx.resetImageExpand();
      ctx.resetImageEditText();
      ctx.resetImageGridSplit();
      ctx.resetVideoDialogue();
      ctx.resetVideoHdPanel();
      ctx.resetVideoFramesPanel();
      ctx.bumpToolbarRevision();
      const g = ctx.graph.value;
      const showImageGenPrompt = Boolean(g) &&
          shouldOpenImageGenPromptBar(g!, node.id, data);
      const showVideoGenPrompt = data.kind === 'video' &&
          data.mode === 'picker' &&
          !data.previewUrl &&
          data.uploadState !== 'uploading';
      if (showImageGenPrompt) {
          ctx.openImageGenPromptBar(node.id);
          if (!ctx.showElementSelectMode.value) {
              ctx.resetImageDialogue();
          }
      }
      else if (showVideoGenPrompt) {
          ctx.openVideoGenPromptBar(node.id, data.videoGenTab ?? 'text2video');
          if (!ctx.showElementSelectMode.value) {
              ctx.resetImageDialogue();
          }
      }
      else {
          ctx.closeImageGenPromptBar();
          ctx.closeVideoGenPromptBar();
          const showTextPromptBar = (data.kind === 'text' || data.kind === 'audio') &&
              (data.mode === 'picker' || (data.kind === 'text' && data.promptBarPinned));
          ctx.activePickerNodeId.value = showTextPromptBar ? node.id : '';
          if (ctx.activePickerNodeId.value && data.kind === 'text') {
              ctx.loadPromptBarContext(node.id);
          }
          // 图片/视频节点单击仅选中并显示上方操作栏；下方对话框改为双击打开
          if (!ctx.showElementSelectMode.value) {
              ctx.resetImageDialogue();
          }
      }
      ctx.syncSelectionFromGraph();
  };
  
  ctx.resetCanvasInteractionState = function resetCanvasInteractionState() {
      ctx.cancelVideoToolbarDefer();
      ctx.closeAddMenu();
      ctx.closeProjectMenu();
      ctx.closeUserMenu();
      ctx.closeZoomMenu();
      ctx.closeShortcutsPanel();
      ctx.closeHistoryPanel();
      ctx.closeConnectMenu();
      ctx.closeImageContextMenu();
      ctx.setTextEditorToolbarActive(false);
      ctx.activePickerNodeId.value = '';
      ctx.graph.value?.cleanSelection();
      ctx.selectedNodeId.value = '';
      ctx.selectedNodeIds.value = [];
      ctx.selectedEdgeId.value = '';
      ctx.selectedKind.value = null;
      ctx.resetImageToolbarMore();
      ctx.resetImageDialogue();
      ctx.resetImageCrop();
      ctx.resetImageExpand();
      ctx.resetImageEditText();
      ctx.resetImageGridSplit();
      ctx.resetVideoDialogue();
      ctx.resetVideoHdPanel();
      ctx.resetVideoFramesPanel();
      ctx.closeImageGenPromptBar();
      ctx.closeVideoGenPromptBar();
      ctx.closeTextExpand();
      ctx.exitElementSelectMode({ force: true });
      ctx.exitVideoGenCanvasPickMode();
      ctx.exitImageDialogueCanvasPickMode();
      ctx.syncNodeSelectionHighlight([]);
      ctx.selectedEdgeId.value = '';
      ctx.clearEdgeHoverState();
  };
  
  ctx.dismissOneCanvasLayer = function dismissOneCanvasLayer() {
      if (ctx.showSaveSkillPopover.value) {
          ctx.closeSaveSkillPopover();
          return true;
      }
      if (ctx.imagePreviewUrl.value) {
          ctx.closeImagePreview();
          return true;
      }
      if (ctx.showShortcutsPanel.value) {
          ctx.closeShortcutsPanel();
          return true;
      }
      if (ctx.showImageCrop.value) {
          ctx.closeImageCrop();
          return true;
      }
      if (ctx.showImageGridSplit.value) {
          ctx.closeImageGridSplit();
          return true;
      }
      if (ctx.showImageErase.value) {
          ctx.closeImageErase();
          return true;
      }
      if (ctx.showImageInpaint.value) {
          ctx.closeImageInpaint();
          return true;
      }
      if (ctx.showImageExpand.value) {
          ctx.closeImageExpand();
          return true;
      }
      if (ctx.showImageEditText.value) {
          ctx.closeImageEditText();
          return true;
      }
      if (ctx.nodeOverlaysRef.value?.dismissVideoGenPromptOverlay()) {
          return true;
      }
      if (ctx.showImageToolbarCustomize.value) {
          ctx.closeImageToolbarCustomize();
          return true;
      }
      if (ctx.showImageHdMenu.value) {
          ctx.showImageHdMenu.value = false;
          return true;
      }
      if (ctx.showImageToolbarMoreMenu.value) {
          ctx.showImageToolbarMoreMenu.value = false;
          return true;
      }
      if (ctx.showImageToolbarMore.value) {
          ctx.resetImageToolbarMore();
          return true;
      }
      const g = ctx.graph.value as CanvasGraph | null;
      if (ctx.showImageContextMenu.value) {
          if (g?.__suppressBlankCloseForConnect) {
              g.__suppressBlankCloseForConnect = false;
              return true;
          }
          ctx.closeImageContextMenu();
          return true;
      }
      if (ctx.showConnectMenu.value) {
          // 打开菜单当次 mouseup 可能同步触发 blank:click，用 flag 跳过这一次
          if (g?.__suppressBlankCloseForConnect) {
              g.__suppressBlankCloseForConnect = false;
              return true;
          }
          ctx.closeConnectMenu();
          return true;
      }
      if (g?.__suppressBlankCloseForConnect) {
          g.__suppressBlankCloseForConnect = false;
      }
      if (ctx.showAddMenu.value) {
          ctx.closeAddMenu();
          return true;
      }
      if (ctx.showProjectMenu.value) {
          ctx.closeProjectMenu();
          return true;
      }
      if (ctx.showProjectBrowser.value) {
          ctx.closeProjectBrowser();
          return true;
      }
      if (ctx.showUserMenu.value) {
          ctx.closeUserMenu();
          return true;
      }
      if (ctx.showZoomMenu.value) {
          ctx.closeZoomMenu();
          return true;
      }
      if (ctx.showAssetsPanel.value) {
          ctx.showAssetsPanel.value = false;
          return true;
      }
      if (ctx.showAssetCenterPanel.value) {
          ctx.closeAssetCenterPanel();
          return true;
      }
      if (ctx.showHistoryPanel.value) {
          ctx.closeHistoryPanel();
          return true;
      }
      if (ctx.showVideoFramesPanel.value) {
          ctx.resetVideoFramesPanel();
          return true;
      }
      if (ctx.showVideoHdPanel.value) {
          ctx.resetVideoHdPanel();
          return true;
      }
      if (ctx.showVideoDialogue.value) {
          ctx.resetVideoDialogue();
          return true;
      }
      if (ctx.showImageDialogue.value) {
          ctx.resetImageDialogue();
          return true;
      }
      if (ctx.textExpandOpen.value) {
          ctx.closeTextExpand();
          return true;
      }
      if (ctx.activeImageGenPromptNodeId.value) {
          ctx.closeImageGenPromptBar();
          return true;
      }
      if (ctx.activeVideoGenPromptNodeId.value) {
          ctx.closeVideoGenPromptBar();
          return true;
      }
      if (ctx.activePickerNodeId.value) {
          ctx.activePickerNodeId.value = '';
          return true;
      }
      if (ctx.textEditorToolbarActive.value) {
          ctx.setTextEditorToolbarActive(false);
          return true;
      }
      if (ctx.showVideoGenCanvasPickMode.value) {
          ctx.exitVideoGenCanvasPickMode();
          return true;
      }
      if (ctx.showImageDialogueCanvasPickMode.value) {
          ctx.exitImageDialogueCanvasPickMode();
          return true;
      }
      if (ctx.showElementSelectMode.value) {
          ctx.exitElementSelectMode();
          return true;
      }
      if (ctx.hoveredEdgeId.value) {
          ctx.clearEdgeHoverState();
          return true;
      }
      if (ctx.selectedEdgeId.value) {
          ctx.clearEdgeSelection();
          ctx.updateNodeToolbar();
          return true;
      }
      if (ctx.selectedNodeId.value || ctx.selectedNodeIds.value.length) {
          ctx.graph.value?.cleanSelection();
          ctx.selectedNodeId.value = '';
          ctx.selectedNodeIds.value = [];
          ctx.selectedKind.value = null;
          ctx.setTextEditorToolbarActive(false);
          ctx.resetImageToolbarMore();
          ctx.resetImageDialogue();
          ctx.resetImageCrop();
          ctx.resetImageGridSplit();
          ctx.resetVideoDialogue();
          ctx.resetVideoHdPanel();
          ctx.resetVideoFramesPanel();
          ctx.syncNodeSelectionHighlight([]);
          ctx.updateNodeToolbar();
          return true;
      }
      return false;
  };
  
  ctx.handleNodeDataChange = function handleNodeDataChange({ node }: {
      node: Node;
  }) {
      const data = node.getData() as CanvasNodeData;
      if (data.mode === 'editor' &&
          ctx.activePickerNodeId.value === node.id &&
          !data.promptBarPinned) {
          ctx.activePickerNodeId.value = '';
      }
      if (ctx.activePickerNodeId.value === node.id && data.kind === 'text') {
          ctx.promptSourcePreviewUrl.value = data.sourcePreviewUrl ?? '';
          ctx.promptSourceFileName.value = data.sourceFileName ?? '';
          ctx.promptSourcePreviews.value = Array.isArray(data.imageSourceRefs)
              ? data.imageSourceRefs.filter((item) => item.previewUrl)
              : [];
      }
      if (ctx.selectedNodeId.value === node.id) {
          ctx.selectedKind.value = data.kind;
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
      }
  };
  
  ctx.getHistoryMeta = function getHistoryMeta() {
      return {
          projectId: ctx.activeProjectId.value,
          projectName: ctx.currentProjectName.value,
          canvasBgTheme: ctx.canvasBgTheme.value,
          gridVisible: ctx.gridVisible.value,
          panMode: ctx.panMode.value,
          showMinimap: ctx.showMinimap.value,
      };
  };
}
