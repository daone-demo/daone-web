// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Connections 域的选中同步 / 缩放居中 / 边 hover 删除 / 工具栏与 prompt/group 浮层定位 / RAF / resize overlay / addNode。
 */
import { sanitizeRichTextHtml } from '@/utils/sanitizeHtml';
import type { Edge,Graph,Node } from '@antv/x6';
import { computed,nextTick,provide } from 'vue';
import type { CanvasGraph,CanvasNodeData,ImageResizeCorner,ImageSourceRef,NodeKind,TextFormatCommand } from '../../sharedImports';
import { addCanvasNode,canImageNodeAcceptIncoming,centerGraphContent,connectGenEdge,detachEdgeRelation,disconnectImageFromVideo,findImageToVideoEdge,findIncomingTextNodes,formatDimensions,getEdgeDeleteButtonPosition,getGroupBoxNodeIds,getGroupDisplayMemberCount,getGroupScreenBoxFromGraphBox,getImageExpandOverlayLayout,getImageNodeMediaScreenBox,getMultiSelectionToolbarPosition,getNodeCropOverlayPosition,getNodeDialoguePosition,getNodeImageGenPromptPosition,getNodePromptPosition,getNodeSidePanelPosition,getNodeTextDownloadPosition,getNodeTextFormatToolbarPosition,getNodeToolbarPosition,getNodeVideoGenPromptPosition,getVideoSourceRefs,getViewportCenterLocal,graphLocalToContainerOffset,hasVisibleNodesInViewport,IMG2PROMPT_DEFAULT_INSTRUCTION,isPersistedEdge,listCanvasGroups,normalizeGroupMembership,resolveGroupDisplayTitle,resolveGroupGraphBBox,shouldOpenImageGenPromptBar,startImageNodeCornerResize,syncEdgeSelectionHighlight,syncImageNodeSizeToMediaAspect,syncPendingImageTargetFromSources,syncTextNodeImageSource,toPersistedVideoSourceRefs,VIDEO_GEN_TAB_IMAGE_RULES } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installConnectionSelectionOverlays(ctx: CoreRuntimeContext) {
  ctx.syncNodeCount = function syncNodeCount() {
      ctx.nodeCount.value = ctx.graph.value?.getNodes().length ?? 0;
      if (ctx.nodeCount.value === 0) {
          ctx.activePickerNodeId.value = '';
          ctx.closeImageGenPromptBar();
          ctx.closeVideoGenPromptBar();
          ctx.selectedNodeId.value = '';
          ctx.showBackToNodesBanner.value = false;
          return;
      }
      ctx.syncViewportNodeVisibility();
  };
  
  ctx.syncViewportNodeVisibility = function syncViewportNodeVisibility() {
      const g = ctx.graph.value;
      const root = ctx.canvasRef.value;
      if (!g || !root || ctx.nodeCount.value === 0 || ctx.isRecenteringToNodes.value) {
          if (!ctx.isRecenteringToNodes.value) {
              ctx.showBackToNodesBanner.value = false;
          }
          return;
      }
      ctx.showBackToNodesBanner.value = !hasVisibleNodesInViewport(g, root);
  };
  
  ctx.recenterToNodes = function recenterToNodes() {
      const g = ctx.graph.value;
      if (!g || ctx.isRecenteringToNodes.value)
          return;
      ctx.isRecenteringToNodes.value = true;
      ctx.showBackToNodesBanner.value = false;
      centerGraphContent(g, {
          animate: true,
          duration: '360ms',
          onComplete: () => {
              ctx.isRecenteringToNodes.value = false;
              ctx.syncZoom();
              ctx.syncViewportNodeVisibility();
              ctx.updateNodeToolbar();
          },
      });
  };
  
  ctx.syncZoom = function syncZoom(scale?: number) {
      if (typeof scale === 'number' && !Number.isNaN(scale)) {
          ctx.zoomLevel.value = scale;
          return;
      }
      ctx.zoomLevel.value = ctx.graph.value?.zoom() ?? 1;
  };
  
  ctx.getGraphCenter = function getGraphCenter() {
      const g = ctx.graph.value;
      if (!g)
          return { x: 400, y: 320 };
      return getViewportCenterLocal(g);
  };
  
  ctx.getGraphSelectedNodeIds = function getGraphSelectedNodeIds() {
      const g = ctx.graph.value;
      if (!g)
          return [];
      return g
          .getSelectedCells()
          .filter((cell) => cell.isNode())
          .map((cell) => cell.id);
  };
  
  ctx.syncNodeSelectionHighlight = function syncNodeSelectionHighlight(selectedIds: string | string[] = []) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const idSet = new Set(Array.isArray(selectedIds)
          ? selectedIds
          : selectedIds
              ? [selectedIds]
              : ctx.getGraphSelectedNodeIds());
      g.getNodes().forEach((node) => {
          const data = node.getData() as CanvasNodeData;
          const isSelected = idSet.has(node.id);
          if (Boolean(data.isSelected) === isSelected) {
              return;
          }
          node.setData({ ...data, isSelected });
      });
  };
  
  ctx.syncSelectionFromGraph = function syncSelectionFromGraph() {
      const g = ctx.graph.value;
      if (!g)
          return;
      if (ctx.showVideoGenCanvasPickMode.value || ctx.showImageDialogueCanvasPickMode.value) {
          ctx.restoreCanvasPickTargetSelection();
          return;
      }
      const prevDialogueNodeId = ctx.activeImageDialogueNodeId;
      const prevVideoDialogueNodeId = ctx.activeVideoDialogueNodeId;
      const ids = ctx.getGraphSelectedNodeIds();
      ctx.selectedNodeIds.value = ids;
      if (ids.length > 0) {
          ctx.selectedEdgeId.value = '';
          ctx.clearEdgeHoverState();
          const primaryId = ids[ids.length - 1];
          const cell = g.getCellById(primaryId);
          if (cell?.isNode()) {
              ctx.selectedNodeId.value = primaryId;
              ctx.selectedKind.value = (cell.getData() as CanvasNodeData).kind;
          }
      }
      else {
          ctx.selectedNodeId.value = '';
          ctx.selectedKind.value = null;
      }
      if (prevDialogueNodeId && prevDialogueNodeId !== ctx.selectedNodeId.value) {
          ctx.persistImageDialogueFields(prevDialogueNodeId);
      }
      if (prevVideoDialogueNodeId && prevVideoDialogueNodeId !== ctx.selectedNodeId.value) {
          ctx.persistVideoDialogueFields(prevVideoDialogueNodeId);
      }
      // 标记选点进行中：不切换对话框归属，避免标记中状态带到其他节点对话框
      if (ctx.showImageDialogue.value &&
          ctx.selectedNodeId.value &&
          ctx.selectedKind.value === 'image' &&
          !ctx.showElementSelectMode.value) {
          ctx.loadImageDialogueFields(ctx.selectedNodeId.value);
      }
      else if (!ctx.selectedNodeId.value) {
          ctx.activeImageDialogueNodeId = '';
      }
      if (ctx.showVideoDialogue.value && ctx.selectedNodeId.value && ctx.selectedKind.value === 'video') {
          ctx.loadVideoDialogueFields(ctx.selectedNodeId.value);
      }
      else if (!ctx.selectedNodeId.value) {
          ctx.activeVideoDialogueNodeId = '';
      }
      ctx.syncNodeSelectionHighlight(ids);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.selectGraphNodes = function selectGraphNodes(target: Node | string | (Node | string)[]) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cells = (Array.isArray(target) ? target : [target])
          .map((item) => (typeof item === 'string' ? g.getCellById(item) : item))
          .filter((cell): cell is Node => cell != null && cell.isNode());
      ctx.clearEdgeSelection();
      g.cleanSelection();
      if (cells.length)
          g.select(cells);
      ctx.syncSelectionFromGraph();
  };
  
  ctx.selectSingleGraphNode = function selectSingleGraphNode(node: Node) {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.clearEdgeSelection();
      g.cleanSelection();
      g.select(node);
  };
  
  ctx.syncEdgeHighlight = function syncEdgeHighlight() {
      const g = ctx.graph.value;
      if (!g)
          return;
      syncEdgeSelectionHighlight(g, ctx.selectedEdgeId.value, ctx.hoveredEdgeId.value);
  };
  
  ctx.edgeHoverLeaveTimer = 0;
  
  ctx.updateEdgeDeleteButtonPosition = function updateEdgeDeleteButtonPosition() {
      const g = ctx.graph.value;
      const root = ctx.canvasRef.value;
      const id = ctx.hoveredEdgeId.value;
      if (!g || !root || !id)
          return;
      const edge = g.getCellById(id);
      if (!edge?.isEdge() || !isPersistedEdge(edge as Edge)) {
          ctx.hoveredEdgeId.value = '';
          return;
      }
      ctx.edgeDeleteBtnPos.value = getEdgeDeleteButtonPosition(g, edge as Edge, root);
  };
  
  ctx.clearEdgeHoverState = function clearEdgeHoverState() {
      window.clearTimeout(ctx.edgeHoverLeaveTimer);
      ctx.hoveredEdgeId.value = '';
      ctx.syncEdgeHighlight();
  };
  
  ctx.handleEdgeMouseEnter = function handleEdgeMouseEnter({ edge }: {
      edge: Edge;
  }) {
      if (!isPersistedEdge(edge))
          return;
      window.clearTimeout(ctx.edgeHoverLeaveTimer);
      ctx.hoveredEdgeId.value = edge.id;
      ctx.syncEdgeHighlight();
      ctx.updateEdgeDeleteButtonPosition();
  };
  
  ctx.handleEdgeMouseLeave = function handleEdgeMouseLeave() {
      window.clearTimeout(ctx.edgeHoverLeaveTimer);
      ctx.edgeHoverLeaveTimer = window.setTimeout(() => {
          ctx.hoveredEdgeId.value = '';
          ctx.syncEdgeHighlight();
      }, 120);
  };
  
  ctx.handleEdgeDeletePointerEnter = function handleEdgeDeletePointerEnter() {
      window.clearTimeout(ctx.edgeHoverLeaveTimer);
  };
  
  ctx.handleEdgeDeletePointerLeave = function handleEdgeDeletePointerLeave() {
      ctx.handleEdgeMouseLeave();
  };
  
  ctx.removeHoveredEdge = function removeHoveredEdge() {
      const id = ctx.hoveredEdgeId.value;
      if (!id)
          return;
      ctx.selectedEdgeId.value = id;
      ctx.hoveredEdgeId.value = '';
      ctx.removeSelectedEdge();
  };
  
  ctx.showEdgeDeleteButton = computed(() => Boolean(ctx.hoveredEdgeId.value));
  
  ctx.clearEdgeSelection = function clearEdgeSelection() {
      const g = ctx.graph.value;
      if (!g || !ctx.selectedEdgeId.value)
          return;
      ctx.selectedEdgeId.value = '';
      ctx.syncEdgeHighlight();
  };
  
  ctx.handleEdgeClick = function handleEdgeClick({ edge, e }: {
      edge: Edge;
      e?: MouseEvent;
  }) {
      // 预览连线（添加上下文）上的点击应关闭菜单，而非忽略
      if (!isPersistedEdge(edge)) {
          if (ctx.showConnectMenu.value) {
              e?.stopPropagation();
              ctx.closeConnectMenu();
          }
          return;
      }
      e?.stopPropagation();
      const g = ctx.graph.value;
      if (!g)
          return;
      if (ctx.showConnectMenu.value) {
          ctx.closeConnectMenu();
      }
      g.cleanSelection();
      ctx.selectedNodeId.value = '';
      ctx.selectedNodeIds.value = [];
      ctx.selectedKind.value = null;
      ctx.syncNodeSelectionHighlight([]);
      ctx.selectedEdgeId.value = edge.id;
      ctx.syncEdgeHighlight();
      ctx.updateNodeToolbar();
  };
  
  ctx.removeSelectedEdge = function removeSelectedEdge() {
      const g = ctx.graph.value;
      const edgeId = ctx.selectedEdgeId.value;
      if (!g || !edgeId)
          return false;
      const cell = g.getCellById(edgeId);
      if (!cell?.isEdge() || !isPersistedEdge(cell as Edge))
          return false;
      const edge = cell as Edge;
      const relation = detachEdgeRelation(g, edge);
      const canvasGraph = g as CanvasGraph;
      if (canvasGraph.__connectPreviewEdgeId === edgeId) {
          canvasGraph.__connectPreviewEdgeId = '';
      }
      g.removeEdge(edgeId);
      ctx.selectedEdgeId.value = '';
      ctx.clearEdgeHoverState();
      if (relation?.targetId === ctx.activePickerNodeId.value) {
          ctx.loadPromptBarContext(relation.targetId);
      }
      if (relation?.targetId === ctx.activeImageGenPromptNodeId.value) {
          ctx.loadImageGenPromptFields(relation.targetId);
      }
      if (relation?.targetId) {
          const targetCell = g.getCellById(relation.targetId);
          const targetData = targetCell?.getData() as CanvasNodeData | undefined;
          if (targetData?.kind === 'video') {
              ctx.syncVideoSourceRefsSnapshot(relation.targetId);
          }
      }
      if (relation?.targetId === ctx.selectedNodeId.value) {
          ctx.bumpToolbarRevision();
      }
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.updatePromptBarPosition = function updatePromptBarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.activePickerNodeId.value;
      if (!g || !overlayRoot || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      ctx.promptPos.value = getNodePromptPosition(g, cell as Node, overlayRoot);
      // 文生视频/文生图底栏控件与对话面板一致，需要更宽布局
      if (ctx.isText2VideoTask.value || ctx.isText2ImageTask.value) {
          const containerRect = overlayRoot.getBoundingClientRect();
          const maxWidth = Math.min(720, containerRect.width - 48);
          ctx.promptPos.value = {
              ...ctx.promptPos.value,
              width: Math.min(maxWidth, Math.max(ctx.promptPos.value.width, 680)),
          };
      }
  };
  
  ctx.updateTextFormatToolbarPosition = function updateTextFormatToolbarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !overlayRoot || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'text' || data.mode !== 'editor')
          return;
      ctx.textFormatToolbarPos.value = getNodeTextFormatToolbarPosition(g, cell as Node, overlayRoot);
      ctx.textDownloadPos.value = getNodeTextDownloadPosition(g, cell as Node, overlayRoot);
  };
  
  ctx.updateImageGenPromptBarPosition = function updateImageGenPromptBarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.activeImageGenPromptNodeId.value;
      if (!g || !overlayRoot || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      ctx.imageGenPromptPos.value = getNodeImageGenPromptPosition(g, cell as Node, overlayRoot);
  };
  
  ctx.updateVideoGenPromptBarPosition = function updateVideoGenPromptBarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.activeVideoGenPromptNodeId.value;
      if (!g || !overlayRoot || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const base = getNodeVideoGenPromptPosition(g, cell as Node, overlayRoot);
      ctx.videoGenPromptPos.value = base;
  };
  
  ctx.updateMultiSelectToolbarPosition = function updateMultiSelectToolbarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const ids = ctx.selectedNodeIds.value;
      if (!g || !overlayRoot || ids.length < 2)
          return;
      ctx.multiSelectToolbarPos.value = getMultiSelectionToolbarPosition(g, ids, overlayRoot);
  };
  
  ctx.resolveGroupDragPreviewNode = function resolveGroupDragPreviewNode(groupId: string) {
      const g = ctx.graph.value;
      const draggingId = ctx.groupMoveState.draggingNodeId;
      if (!g || !draggingId)
          return null;
      const draggingNode = g.getCellById(draggingId);
      if (!draggingNode?.isNode())
          return null;
      const data = draggingNode.getData() as CanvasNodeData;
      if (data.groupId === groupId)
          return draggingNode as Node;
      const boxNodeIds = getGroupBoxNodeIds(g, groupId);
      return boxNodeIds.includes(draggingNode.id) ? (draggingNode as Node) : null;
  };
  
  ctx.updateGroupToolbarPosition = function updateGroupToolbarPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !overlayRoot) {
          ctx.groupOverlayItems.value = [];
          return;
      }
      const groups = listCanvasGroups(g);
      const resizingId = ctx.groupOverlayResize.active ? ctx.groupOverlayResize.groupId : '';
      ctx.groupOverlayItems.value = groups.map((group) => {
          if (resizingId && group.groupId === resizingId) {
              const box = ctx.groupOverlayResize.currentBox;
              const topLeft = graphLocalToContainerOffset(g, box.x, box.y, overlayRoot);
              const bottomRight = graphLocalToContainerOffset(g, box.x + box.width, box.y + box.height, overlayRoot);
              const nodeCount = group.nodeIds.length;
              return {
                  groupId: group.groupId,
                  nodeIds: group.nodeIds,
                  nodeCount,
                  title: resolveGroupDisplayTitle(g, group.groupId, nodeCount),
                  left: topLeft.left,
                  top: topLeft.top,
                  width: Math.max(0, bottomRight.left - topLeft.left),
                  height: Math.max(0, bottomRight.top - topLeft.top),
              };
          }
          const draggingNode = ctx.resolveGroupDragPreviewNode(group.groupId);
          const draggingMember = draggingNode && (draggingNode.getData() as CanvasNodeData).groupId === group.groupId
              ? draggingNode
              : null;
          const boxNodeIds = getGroupBoxNodeIds(g, group.groupId, draggingMember);
          const nodeCount = getGroupDisplayMemberCount(g, group.groupId, draggingMember);
          const graphBox = resolveGroupGraphBBox(g, group.groupId, boxNodeIds);
          const box = getGroupScreenBoxFromGraphBox(g, graphBox, overlayRoot);
          return {
              groupId: group.groupId,
              nodeIds: group.nodeIds,
              nodeCount,
              title: resolveGroupDisplayTitle(g, group.groupId, nodeCount),
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
          };
      });
      const active = ctx.activeGroupSelection.value;
      if (active) {
          const item = ctx.groupOverlayItems.value.find((entry) => entry.groupId === active.groupId);
          if (item) {
              ctx.groupToolbarPos.value = {
                  left: item.left + item.width / 2,
                  top: item.top - 30,
              };
          }
      }
  };
  
  ctx.updateNodeToolbar = function updateNodeToolbar(options?: {
      skipImageResizeOverlay?: boolean;
      skipDialoguePos?: boolean;
  }) {
      ctx.updatePromptBarPosition();
      ctx.updateTextFormatToolbarPosition();
      ctx.updateImageGenPromptBarPosition();
      ctx.updateVideoGenPromptBarPosition();
      ctx.updateAddMenuPosition();
      ctx.updateConnectMenuPosition();
      ctx.updateMultiSelectToolbarPosition();
      ctx.updateGroupToolbarPosition();
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !overlayRoot || !id) {
          if (!options?.skipImageResizeOverlay) {
              ctx.updateImageResizeOverlay();
          }
          return;
      }
      const cell = g.getCellById(id);
      if (!cell?.isNode()) {
          if (!options?.skipImageResizeOverlay) {
              ctx.updateImageResizeOverlay();
          }
          return;
      }
      const data = cell.getData() as CanvasNodeData;
      ctx.selectedKind.value = data.kind;
      const node = cell as Node;
      ctx.toolbarPos.value = getNodeToolbarPosition(g, node, overlayRoot);
      if (!options?.skipDialoguePos) {
          ctx.dialoguePos.value = getNodeDialoguePosition(g, node, overlayRoot);
      }
      if (ctx.showImageCrop.value) {
          ctx.imageCropPos.value = getNodeCropOverlayPosition(g, node, overlayRoot);
      }
      if (ctx.showImageGridSplit.value) {
          syncImageNodeSizeToMediaAspect(node);
          const box = getImageNodeMediaScreenBox(g, node, overlayRoot);
          ctx.imageGridSplitPos.value = {
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
          };
      }
      if (ctx.showImageErase.value) {
          ctx.imageErasePos.value = getNodeCropOverlayPosition(g, node, overlayRoot);
      }
      if (ctx.showImageInpaint.value) {
          ctx.imageInpaintPos.value = getNodeCropOverlayPosition(g, node, overlayRoot, 520, 520);
      }
      if (ctx.showImageExpand.value) {
          syncImageNodeSizeToMediaAspect(node);
          ctx.imageExpandPos.value = getImageExpandOverlayLayout(g, node, overlayRoot);
      }
      if (ctx.showImageEditText.value) {
          const panelHeight = Math.max(320, node.getBBox().height);
          const base = getNodeSidePanelPosition(g, node, overlayRoot, 380, panelHeight);
          ctx.imageEditTextPos.value = {
              left: base.left,
              top: base.top,
              width: base.width,
              height: panelHeight,
          };
      }
      if (data.kind === 'video' && ctx.showVideoHdPanel.value) {
          ctx.videoHdPos.value = getNodeSidePanelPosition(g, node, overlayRoot);
      }
      if (!options?.skipImageResizeOverlay) {
          ctx.updateImageResizeOverlay();
      }
      ctx.updateImageMarkHintPositions();
  };
  
  type ToolbarUpdateOptions = Parameters<typeof ctx.updateNodeToolbar>[0];
  
  ctx.toolbarUpdateRaf = 0;
  
  ctx.scheduleUpdateNodeToolbar = function scheduleUpdateNodeToolbar(options?: ToolbarUpdateOptions) {
      ctx.pendingToolbarUpdateOptions = options;
      if (ctx.toolbarUpdateRaf)
          return;
      ctx.toolbarUpdateRaf = window.requestAnimationFrame(() => {
          ctx.toolbarUpdateRaf = 0;
          const nextOptions = ctx.pendingToolbarUpdateOptions;
          ctx.pendingToolbarUpdateOptions = undefined;
          ctx.updateNodeToolbar(nextOptions);
      });
  };
  
  ctx.viewportVisibilityRaf = 0;
  
  ctx.scheduleViewportNodeVisibilitySync = function scheduleViewportNodeVisibilitySync() {
      if (ctx.viewportVisibilityRaf)
          return;
      ctx.viewportVisibilityRaf = window.requestAnimationFrame(() => {
          ctx.viewportVisibilityRaf = 0;
          ctx.syncViewportNodeVisibility();
      });
  };
  
  ctx.paintImageResizeOverlay = function paintImageResizeOverlay(box: {
      left: number;
      top: number;
      width: number;
      height: number;
      dimensionLabel: string;
      nodeId: string;
  } | null) {
      if (!box) {
          ctx.showImageResizeOverlay.value = false;
          ctx.nodeOverlaysRef.value?.applyImageResizeOverlayBox(null);
          return;
      }
      ctx.imageResizeOverlay.value = box;
      ctx.showImageResizeOverlay.value = true;
      ctx.nodeOverlaysRef.value?.applyImageResizeOverlayBox(box);
  };
  
  ctx.shouldHideImageDimensionOverlay = function shouldHideImageDimensionOverlay() {
      return (ctx.showImageCrop.value ||
          ctx.showImageGridSplit.value ||
          ctx.showImageErase.value ||
          ctx.showImageInpaint.value ||
          ctx.showImageExpand.value ||
          ctx.showImageEditText.value ||
          ctx.showImageDialogue.value ||
          ctx.showVideoDialogue.value ||
          ctx.showPromptBar.value ||
          ctx.showImageGenPromptBar.value ||
          ctx.showVideoGenPromptBar.value);
  };
  
  ctx.updateImageResizeOverlay = function updateImageResizeOverlay() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const id = ctx.selectedNodeId.value;
      if (!g ||
          !overlayRoot ||
          !id ||
          ctx.selectedNodeIds.value.length > 1 ||
          ctx.shouldHideImageDimensionOverlay()) {
          ctx.paintImageResizeOverlay(null);
          return;
      }
      const cell = g.getCellById(id);
      if (!cell?.isNode()) {
          ctx.paintImageResizeOverlay(null);
          return;
      }
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'image' || !data.previewUrl?.trim()) {
          ctx.paintImageResizeOverlay(null);
          return;
      }
      if (!data.mediaWidth || !data.mediaHeight) {
          ctx.paintImageResizeOverlay(null);
          return;
      }
      if (data.uploadState === 'uploading' || data.imageGenState === 'loading') {
          ctx.paintImageResizeOverlay(null);
          return;
      }
      const node = cell as Node;
      const box = getImageNodeMediaScreenBox(g, node, overlayRoot);
      ctx.paintImageResizeOverlay({
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          dimensionLabel: formatDimensions(data.mediaWidth, data.mediaHeight),
          nodeId: id,
      });
  };
  
  ctx.onImageResizePointerDown = function onImageResizePointerDown(event: MouseEvent, corner: ImageResizeCorner) {
      const g = ctx.graph.value;
      const id = ctx.imageResizeOverlay.value.nodeId;
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      startImageNodeCornerResize(g, cell as Node, event, corner, () => {
          ctx.updateImageResizeOverlay();
          ctx.updateNodeToolbar();
          ctx.bumpToolbarRevision();
      });
  };
  
  ctx.addNode = function addNode(kind: NodeKind, point?: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const position = point ?? ctx.addMenuDropPoint.value ?? ctx.getGraphCenter();
      const node = addCanvasNode(g, kind, position);
      const data = node.getData() as CanvasNodeData;
      if (data.mode === 'picker' && (kind === 'text' || kind === 'audio')) {
          ctx.activePickerNodeId.value = node.id;
          if (kind === 'text') {
              ctx.loadPromptBarContext(node.id);
          }
      }
      ctx.selectedNodeId.value = node.id;
      ctx.updateNodeToolbar();
      ctx.closeAddMenu();
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      return node;
  };
}
