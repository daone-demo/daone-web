// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Groups 粘贴 / 图层 / 媒体预览 / 取消 / 上传 / 空白区按下到 ctx。
 */
import type { Node } from '@antv/x6';
import type { CanvasNodeData } from '../../sharedImports';
import { cancelActiveRubberband } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installGroupMiscInteractions(ctx: CoreRuntimeContext) {
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
