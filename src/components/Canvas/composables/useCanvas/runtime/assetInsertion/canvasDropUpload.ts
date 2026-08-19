/**
 * 职责：安装菜单加点、拖放上传、spawn、文件选择相关动作到 ctx。
 */
import type { Node } from '@antv/x6';
import { clearCanvasAssetDrag,consumeCanvasAssetDragPayload,consumeCanvasElementGroupDragPayload,isCanvasAssetDragActive,wasCanvasAssetDropHandled } from '../../../../canvasAssetDrag';
import type { CanvasElementGroupDragPayload } from '../../../../constants';
import type { CanvasAssetDragPayload,CanvasNodeData,NodeKind } from '../../sharedImports';
import { ADD_NODE_GROUPS,addCanvasNode,CANVAS_ASSET_DRAG_TYPE,CANVAS_ELEMENT_GROUP_DRAG_TYPE,clientPointToGraphLocal,getNodeSize,NODE_SPAWN_GAP_X,NODE_SPAWN_GAP_Y,runUploadSimulation } from '../../sharedImports';
import type { UploadFilter } from '../../state';
import type { CoreRuntimeContext } from '../context';

export function installAssetDropUpload(ctx: CoreRuntimeContext) {
  ctx.addFromMenu = function addFromMenu(kind: NodeKind) {
      const drop = ctx.addMenuDropPoint.value;
      if (drop) {
          ctx.addNode(kind, drop);
          return;
      }
      const center = ctx.getGraphCenter();
      ctx.addNode(kind, {
          x: center.x + (Math.random() - 0.5) * 100,
          y: center.y + (Math.random() - 0.5) * 80,
      });
  };
  
  ctx.hasCanvasFileDrag = function hasCanvasFileDrag(event: DragEvent) {
      const types = Array.from(event.dataTransfer?.types ?? []);
      return (types.includes('Files')
          || types.includes(CANVAS_ASSET_DRAG_TYPE)
          || types.includes(CANVAS_ELEMENT_GROUP_DRAG_TYPE)
          || isCanvasAssetDragActive());
  };
  
  ctx.parseCanvasAssetDragPayload = function parseCanvasAssetDragPayload(raw: string): CanvasAssetDragPayload | null {
      if (!raw)
          return null;
      try {
          const payload = JSON.parse(raw) as CanvasAssetDragPayload;
          return payload.previewUrl ? payload : null;
      }
      catch {
          return null;
      }
  };
  
  ctx.parseCanvasElementGroupDragPayload = function parseCanvasElementGroupDragPayload(raw: string): CanvasElementGroupDragPayload | null {
      if (!raw)
          return null;
      try {
          const payload = JSON.parse(raw) as CanvasElementGroupDragPayload;
          return payload.structureJson != null ? payload : null;
      }
      catch {
          return null;
      }
  };
  
  ctx.getHorizontalUploadSpawnPoint = function getHorizontalUploadSpawnPoint(base: {
      x: number;
      y: number;
  }, index: number, kind: NodeKind) {
      if (index === 0)
          return base;
      const size = getNodeSize(kind, 'editor');
      return {
          x: base.x + index * (size.width + NODE_SPAWN_GAP_X),
          y: base.y,
      };
  };
  
  ctx.spawnMediaFilesAtPoint = function spawnMediaFilesAtPoint(files: File[], basePoint: {
      x: number;
      y: number;
  }, options: {
      pendingNodeId?: string;
  } = {}) {
      const g = ctx.graph.value;
      if (!g || !files.length)
          return;
      const pendingId = options.pendingNodeId ?? '';
      let lastNodeId = '';
      let lastKind: NodeKind = 'image';
      files.forEach((file, index) => {
          const kind: NodeKind = ctx.isVideoUploadFile(file) ? 'video' : 'image';
          let node: Node | undefined;
          if (index === 0 && pendingId) {
              const cell = g.getCellById(pendingId);
              if (cell?.isNode())
                  node = cell as Node;
          }
          if (!node) {
              const point = ctx.getHorizontalUploadSpawnPoint(basePoint, index, kind);
              node = addCanvasNode(g, kind, point, {
                  mode: 'editor',
                  title: file.name,
                  fileName: file.name,
              });
          }
          else {
              const data = { ...(node.getData() as CanvasNodeData) };
              data.mode = 'editor';
              data.title = file.name;
              data.fileName = file.name;
              node.setData(data);
          }
          runUploadSimulation(node, file);
          lastNodeId = node.id;
          lastKind = kind;
      });
      if (lastNodeId) {
          ctx.selectGraphNodes(lastNodeId);
          ctx.selectedKind.value = lastKind;
      }
      ctx.syncNodeCount();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush({ autoSave: false });
  };
  
  ctx.onCanvasDragEnter = function onCanvasDragEnter(event: DragEvent) {
      if (!ctx.hasCanvasFileDrag(event))
          return;
      ctx.canvasFileDragDepth.value += 1;
      ctx.isCanvasFileDragOver.value = true;
  };
  
  ctx.onCanvasDragOver = function onCanvasDragOver(event: DragEvent) {
      if (!ctx.hasCanvasFileDrag(event))
          return;
      event.preventDefault();
      if (event.dataTransfer)
          event.dataTransfer.dropEffect = 'copy';
  };
  
  ctx.onCanvasDragLeave = function onCanvasDragLeave(event: DragEvent) {
      if (!ctx.hasCanvasFileDrag(event))
          return;
      ctx.canvasFileDragDepth.value = Math.max(0, ctx.canvasFileDragDepth.value - 1);
      if (ctx.canvasFileDragDepth.value === 0) {
          ctx.isCanvasFileDragOver.value = false;
      }
  };
  
  ctx.handleCanvasAssetDrop = function handleCanvasAssetDrop(event: DragEvent) {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.canvasFileDragDepth.value = 0;
      ctx.isCanvasFileDragOver.value = false;
      const point = clientPointToGraphLocal(g, event.clientX, event.clientY);
      const groupPayload = ctx.parseCanvasElementGroupDragPayload(event.dataTransfer?.getData(CANVAS_ELEMENT_GROUP_DRAG_TYPE) ?? '')
          ?? consumeCanvasElementGroupDragPayload();
      if (groupPayload) {
          ctx.addElementGroupFromRecord({
              id: groupPayload.recordId,
              name: groupPayload.name,
              structureJson: groupPayload.structureJson,
          }, point);
          return;
      }
      const asset = ctx.parseCanvasAssetDragPayload(event.dataTransfer?.getData(CANVAS_ASSET_DRAG_TYPE) ?? '')
          ?? consumeCanvasAssetDragPayload();
      if (!asset)
          return;
      if (asset.mediaType === 'VIDEO') {
          ctx.addVideoFromAsset(asset, point);
          return;
      }
      ctx.addImageFromAsset(asset, point);
  };
  
  ctx.onCanvasFileDrop = function onCanvasFileDrop(event: DragEvent) {
      event.preventDefault();
      ctx.canvasFileDragDepth.value = 0;
      ctx.isCanvasFileDragOver.value = false;
      if (wasCanvasAssetDropHandled())
          return;
      const g = ctx.graph.value;
      if (!g)
          return;
      if (isCanvasAssetDragActive()) {
          ctx.handleCanvasAssetDrop(event);
          clearCanvasAssetDrag();
          return;
      }
      const groupPayload = ctx.parseCanvasElementGroupDragPayload(event.dataTransfer?.getData(CANVAS_ELEMENT_GROUP_DRAG_TYPE) ?? '');
      if (groupPayload) {
          ctx.handleCanvasAssetDrop(event);
          return;
      }
      const asset = ctx.parseCanvasAssetDragPayload(event.dataTransfer?.getData(CANVAS_ASSET_DRAG_TYPE) ?? '');
      if (asset) {
          ctx.handleCanvasAssetDrop(event);
          return;
      }
      const files = ctx.filterUploadFiles(Array.from(event.dataTransfer?.files ?? []), 'any');
      if (!files.length)
          return;
      const point = clientPointToGraphLocal(g, event.clientX, event.clientY);
      ctx.spawnMediaFilesAtPoint(files, point);
  };
  
  ctx.graphDropEl = null;
  
  ctx.onGraphDragOver = function onGraphDragOver(event: DragEvent) {
      if (!ctx.hasCanvasFileDrag(event))
          return;
      event.preventDefault();
      if (event.dataTransfer)
          event.dataTransfer.dropEffect = 'copy';
  };
  
  ctx.onGraphDrop = function onGraphDrop(event: DragEvent) {
      // graph 在 capture 阶段监听 drop，若不阻止冒泡，.canvas 根节点会再处理一次导致重复建节点
      event.preventDefault();
      event.stopPropagation();
      ctx.onCanvasFileDrop(event);
  };
  
  ctx.bindGraphDropListeners = function bindGraphDropListeners(el: HTMLElement) {
      ctx.graphDropEl = el;
      el.addEventListener('dragover', ctx.onGraphDragOver, true);
      el.addEventListener('drop', ctx.onGraphDrop, true);
  };
  
  ctx.unbindGraphDropListeners = function unbindGraphDropListeners() {
      if (!ctx.graphDropEl)
          return;
      ctx.graphDropEl.removeEventListener('dragover', ctx.onGraphDragOver, true);
      ctx.graphDropEl.removeEventListener('drop', ctx.onGraphDrop, true);
      ctx.graphDropEl = null;
  };
  
  ctx.openFileUploadPicker = function openFileUploadPicker(accept: string, filter: UploadFilter, multiple = true) {
      ctx.triggerFileInputClick(accept, filter, multiple);
  };
  
  ctx.getMultiUploadSpawnPoint = function getMultiUploadSpawnPoint(base: {
      x: number;
      y: number;
  }, index: number, kind: NodeKind) {
      if (index === 0)
          return base;
      const size = getNodeSize(kind, 'editor');
      return {
          x: base.x,
          y: base.y + index * (size.height + NODE_SPAWN_GAP_Y),
      };
  };
  
  ctx.onMenuItem = function onMenuItem(item: (typeof ADD_NODE_GROUPS)[number]['items'][number]) {
      if ('action' in item && item.action === 'upload-image') {
          ctx.openFileUploadPicker('image/*', 'image', true);
          ctx.showAddMenu.value = false;
          return;
      }
      if ('action' in item && item.action === 'upload-video') {
          ctx.openFileUploadPicker('video/*', 'video', true);
          ctx.showAddMenu.value = false;
          return;
      }
      if ('action' in item && item.action === 'upload') {
          ctx.openFileUploadPicker('image/*,video/*', 'any', true);
          ctx.showAddMenu.value = false;
          return;
      }
      // if ('action' in item && item.action === 'history') {
      //   closeAddMenu()
      //   openAssetsPanel()
      //   return
      // }
      ctx.addFromMenu(item.kind);
  };
  
  ctx.onFileSelected = function onFileSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      const files = ctx.filterUploadFiles(Array.from(input.files ?? []), ctx.pendingUploadFilter.value);
      input.value = '';
      if (!files.length || !ctx.graph.value)
          return;
      const basePoint = ctx.addMenuDropPoint.value ?? ctx.getGraphCenter();
      ctx.spawnMediaFilesAtPoint(files, basePoint, {
          pendingNodeId: ctx.pendingUploadNodeId.value,
      });
      ctx.pendingUploadNodeId.value = '';
      ctx.addMenuDropPoint.value = null;
      ctx.closeAddMenu();
  };
}
