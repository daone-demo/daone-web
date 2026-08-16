/**
 * 职责：安装 Groups overlay 命中检测 / 拖拽 / 缩放 / 标题 / 选择到 ctx。
 */
import type { Graph,Node } from '@antv/x6';
import { nextTick } from 'vue';
import { applyGroupSelectionBoxResize,cancelActiveRubberband,clientPointToGraphLocal,getGroupGraphBBox,getNodesInGroup,getScroller,getStoredGroupSelectionBox,reconcileGroupMembershipAfterNodeMove,resizeGroupGraphBox,resolveGroupGraphBBox,setGroupTitle,setStoredGroupSelectionBox,tryAdoptNodeIntoIntersectingGroup,type GroupResizeHandle } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installGroupOverlayInteraction(ctx: CoreRuntimeContext) {
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
  
}
