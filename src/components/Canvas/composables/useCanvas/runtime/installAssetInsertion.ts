// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 AssetInsertion 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { Node } from '@antv/x6';
import { nextTick } from 'vue';
import type { AssetCenterItem } from '../../../assetCenterData';
/**
 * coreRuntime —— 画布核心运行时实现。
 *
 * 职责边界：
 * - 从 bind 解构共享响应式状态，持有非响应式运行时变量（定时器、保存队列等）
 * - 按域注册 computed / 方法 / provide / 生命周期
 * - 对外返回键名必须保持稳定（Canvas/index.vue 解构、defineExpose、provide）
 *
 * 拆分约定（见 corePorts.ts）：
 * 1. 纯函数 → coreHelpers.ts
 * 2. 跨域调用 → ports.xxx.fn() 惰性访问，禁止 register* 模块顶层互 import
 * 3. 目标装配顺序：
 *    derived → selection → history → dialogue → persistence →
 *    media → prompt → marking → connections → assets → groups → lifecycle
 *
 * 迁移策略：先抽 helpers/ports，再按序把下方大块迁到 register*.ts；
 * 本文件在迁移完成前仍承载业务实现，行为与迁出前等价。
 */ import { clearCanvasAssetDrag,consumeCanvasAssetDragPayload,consumeCanvasElementGroupDragPayload,isCanvasAssetDragActive,wasCanvasAssetDropHandled } from '../../../canvasAssetDrag';
import type { CanvasElementGroupDragPayload } from '../../../constants';
import { listSavedCanvasSkills,type SavedCanvasSkill } from '../../../skillStorage';
import type { CanvasAssetDragPayload,CanvasGraph,CanvasNodeData,NodeKind } from '.././sharedImports';
import { ADD_NODE_GROUPS,addCanvasNode,api,applyCanvasBgTheme,CANVAS_ASSET_DRAG_TYPE,CANVAS_ELEMENT_GROUP_DRAG_TYPE,clientPointToGraphLocal,createMinimap,destroyMinimap,getNodeSize,getScroller,NODE_SPAWN_GAP_X,NODE_SPAWN_GAP_Y,normalizeGroupMembership,runUploadSimulation,shouldOpenImageGenPromptBar,tidyCanvas } from '.././sharedImports';
import type { UploadFilter } from '.././state';
import type { CoreRuntimeContext } from './context';

export function installAssetInsertion(ctx: CoreRuntimeContext) {
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
  
  ctx.toggleAddMenu = function toggleAddMenu() {
      if (ctx.showAddMenu.value) {
          ctx.closeAddMenu();
          return;
      }
      ctx.clearCanvasTextSelection();
      ctx.addMenuDropPoint.value = null;
      const overlayRoot = ctx.canvasRef.value;
      if (overlayRoot) {
          const rect = overlayRoot.getBoundingClientRect();
          ctx.addMenuPos.value = {
              left: rect.width / 2,
              top: rect.height - 120,
          };
      }
      ctx.showAddMenu.value = true;
      ctx.showAssetsPanel.value = false;
      ctx.closeHistoryPanel();
      ctx.closeConnectMenu();
  };
  
  ctx.mapSkillToAssetCenterItem = function mapSkillToAssetCenterItem(skill: SavedCanvasSkill): AssetCenterItem {
      const previewUrl = skill.workflow.nodes.find((node) => node.previewUrl)?.previewUrl;
      return {
          id: skill.id,
          name: skill.name,
          role: skill.role || '自定义',
          previewUrl,
          description: skill.description,
      };
  };
  
  ctx.mapElementGroupRecord = function mapElementGroupRecord(record: Record<string, unknown>): AssetCenterItem | null {
      const structure = record.projectStructure as {
          cells?: Array<Record<string, unknown>>;
      } | undefined
          ?? record.structure as {
              cells?: Array<Record<string, unknown>>;
          } | undefined;
      const cells = structure?.cells ?? [];
      const imageNode = cells.find((cell) => cell.type === 'node' && cell.previewUrl);
      const name = String(record.projectName ?? record.name ?? '').trim();
      if (!name)
          return null;
      return {
          id: String(record.id ?? record.elementGroupId ?? `${name}-${record.updatedAt ?? ''}`),
          name,
          role: String(record.role ?? '自定义'),
          previewUrl: typeof imageNode?.previewUrl === 'string' ? imageNode.previewUrl : undefined,
          description: String(record.projectDescription ?? record.description ?? ''),
      };
  };
  
  ctx.loadAssetCenterItems = async function loadAssetCenterItems() {
      ctx.assetCenterLoading.value = true;
      try {
          const projectId = ctx.activeProjectId.value;
          const byId = new Map<string, AssetCenterItem>();
          listSavedCanvasSkills()
              .filter((skill) => !projectId || skill.projectId === projectId)
              .forEach((skill) => {
              byId.set(skill.id, ctx.mapSkillToAssetCenterItem(skill));
          });
          if (projectId) {
              try {
                  const res = await api.queryElementGroups(projectId, { pageSize: 50, page: 1 }) as {
                      records?: Array<Record<string, unknown>>;
                  };
                  for (const record of res?.records ?? []) {
                      const item = ctx.mapElementGroupRecord(record);
                      if (item)
                          byId.set(item.id, item);
                  }
              }
              catch (error) {
                  console.warn('[Canvas] load asset center failed', error);
              }
          }
          ctx.assetCenterItems.value = Array.from(byId.values());
      }
      finally {
          ctx.assetCenterLoading.value = false;
      }
  };
  
  ctx.closeAssetCenterPanel = function closeAssetCenterPanel() {
      ctx.showAssetCenterPanel.value = false;
  };
  
  ctx.openAssetCenterPanel = function openAssetCenterPanel() {
      ctx.showAssetCenterPanel.value = true;
      ctx.closeAddMenu();
      ctx.closeHistoryPanel();
      ctx.showAssetsPanel.value = false;
  };
  
  ctx.toggleAssetCenterPanel = function toggleAssetCenterPanel() {
      if (ctx.showAssetCenterPanel.value) {
          ctx.closeAssetCenterPanel();
      }
      else {
          ctx.openAssetCenterPanel();
      }
  };
  
  ctx.openAssetsPanel = function openAssetsPanel() {
      ctx.showAssetsPanel.value = true;
      ctx.closeAssetCenterPanel();
      ctx.closeAddMenu();
      ctx.assetsLoading.value = true;
      window.setTimeout(() => {
          ctx.assetsLoading.value = false;
      }, 800);
  };
  
  ctx.toggleAssetsPanel = function toggleAssetsPanel() {
      if (ctx.showAssetsPanel.value) {
          ctx.showAssetsPanel.value = false;
      }
      else {
          ctx.closeHistoryPanel();
          ctx.openAssetsPanel();
      }
  };
  
  ctx.closeHistoryPanel = function closeHistoryPanel() {
      ctx.showHistoryPanel.value = false;
  };
  
  ctx.toggleHistoryPanel = function toggleHistoryPanel() {
      if (ctx.showHistoryPanel.value) {
          ctx.closeHistoryPanel();
          return;
      }
      ctx.showHistoryPanel.value = true;
      ctx.showAssetsPanel.value = false;
      ctx.closeAssetCenterPanel();
      ctx.closeAddMenu();
      ctx.closeConnectMenu();
      ctx.closeShortcutsPanel();
      ctx.closeZoomMenu();
  };
  
  ctx.closeShortcutsPanel = function closeShortcutsPanel() {
      ctx.showShortcutsPanel.value = false;
  };
  
  ctx.toggleShortcutsPanel = function toggleShortcutsPanel() {
      ctx.showShortcutsPanel.value = !ctx.showShortcutsPanel.value;
      if (!ctx.showShortcutsPanel.value)
          return;
      ctx.showZoomMenu.value = false;
      ctx.closeAddMenu();
      ctx.closeConnectMenu();
      ctx.showAssetsPanel.value = false;
      ctx.closeAssetCenterPanel();
      ctx.closeHistoryPanel();
  };
  
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
