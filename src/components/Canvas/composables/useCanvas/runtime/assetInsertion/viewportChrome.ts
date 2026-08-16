// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装框选/平移/整理/小地图/主题/网格/缩放及删除选中节点相关动作到 ctx。
 */
import { nextTick } from 'vue';
import { applyCanvasBgTheme,createMinimap,destroyMinimap,getScroller,normalizeGroupMembership,tidyCanvas } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installAssetViewportChrome(ctx: CoreRuntimeContext) {
  ctx.setRubberbandEnabled = function setRubberbandEnabled(enabled: boolean) {
      const g = ctx.graph.value;
      if (!g)
          return;
      if (enabled)
          g.enableRubberband();
      else
          g.disableRubberband();
  };
  
  ctx.togglePanMode = function togglePanMode() {
      ctx.panMode.value = !ctx.panMode.value;
      const scroller = ctx.graph.value ? getScroller(ctx.graph.value) : null;
      if (!scroller)
          return;
      scroller.togglePanning(ctx.panMode.value);
      ctx.setRubberbandEnabled(!ctx.panMode.value);
  };
  
  ctx.handleTidyCanvas = function handleTidyCanvas() {
      const g = ctx.graph.value;
      if (!g || g.getNodes().length === 0)
          return;
      tidyCanvas(g);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.setupMinimap = async function setupMinimap() {
      const g = ctx.graph.value;
      const container = ctx.minimapContainerRef.value;
      if (!g || !container || !ctx.showMinimap.value)
          return;
      if (g.getPlugin('minimap')) {
          destroyMinimap(g);
      }
      await nextTick();
      createMinimap(g, container, ctx.canvasBgTheme.value);
  };
  
  ctx.toggleCanvasBgTheme = async function toggleCanvasBgTheme() {
      ctx.canvasBgTheme.value = ctx.canvasBgTheme.value === 'dark' ? 'light' : 'dark';
      applyCanvasBgTheme(ctx.graph.value, ctx.canvasBgTheme.value, ctx.gridVisible.value);
      if (ctx.showMinimap.value) {
          ctx.teardownMinimap();
          await ctx.setupMinimap();
      }
  };
  
  ctx.teardownMinimap = function teardownMinimap() {
      const g = ctx.graph.value;
      if (!g || !g.getPlugin('minimap'))
          return;
      destroyMinimap(g);
  };
  
  ctx.toggleMinimap = async function toggleMinimap() {
      ctx.showMinimap.value = !ctx.showMinimap.value;
      if (ctx.showMinimap.value) {
          await ctx.setupMinimap();
      }
      else {
          ctx.teardownMinimap();
      }
  };
  
  ctx.toggleGrid = function toggleGrid() {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.gridVisible.value = !ctx.gridVisible.value;
      if (ctx.gridVisible.value) {
          g.showGrid();
          applyCanvasBgTheme(g, ctx.canvasBgTheme.value, ctx.gridVisible.value);
      }
      else {
          g.hideGrid();
      }
  };
  
  ctx.zoomIn = function zoomIn() {
      ctx.graph.value?.zoom(0.12);
      ctx.applyZoomAfterChange();
  };
  
  ctx.zoomOut = function zoomOut() {
      ctx.graph.value?.zoom(-0.12);
      ctx.applyZoomAfterChange();
  };
  
  ctx.removeSelectedNodes = function removeSelectedNodes() {
      const g = ctx.graph.value;
      if (!g)
          return;
      let ids = ctx.getGraphSelectedNodeIds();
      if (!ids.length && ctx.selectedNodeId.value) {
          ids = [ctx.selectedNodeId.value];
      }
      if (!ids.length)
          return;
      ctx.clearEdgeSelection();
      g.cleanSelection();
      ids.forEach((id) => {
          if (ctx.activePickerNodeId.value === id)
              ctx.activePickerNodeId.value = '';
          if (ctx.activeImageGenPromptNodeId.value === id)
              ctx.closeImageGenPromptBar();
          if (ctx.activeVideoGenPromptNodeId.value === id)
              ctx.closeVideoGenPromptBar();
          ctx.textEditorApis.delete(id);
          ctx.detachImageSourceFromDownstream(g, id);
          normalizeGroupMembership(g, id);
          const cell = g.getCellById(id);
          if (cell?.isNode())
              g.removeCell(cell);
      });
      ctx.selectedNodeId.value = '';
      ctx.selectedNodeIds.value = [];
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
      ctx.syncNodeSelectionHighlight([]);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
  };
}
