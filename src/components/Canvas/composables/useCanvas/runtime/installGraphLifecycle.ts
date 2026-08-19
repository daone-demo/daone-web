/**
 * 职责：安装 GraphLifecycle 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick,onBeforeUnmount,onMounted } from 'vue';
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
 */ import { clearCanvasAssetDrag,setCanvasAssetDropHandler } from '../../../canvasAssetDrag';
import { attachChatTaskToNode,followChatGenerationTaskOnNode,linkChatTaskNodeToParent,normalizeChatTaskType,resolveChatTaskTargetNode,resolveChatTaskTitle,updateChatTaskNodeTitle,type ChatTaskCreatedPayload,type ChatTaskUpdatedPayload,} from '../../../chatGenerationTask';
import { normalizeAssetId } from '../../../constants';
import { addElementGroupRecordToCanvas } from '../../../elementGroupCanvas';
import { cancelAllGenerationTaskPolling,isGenerationProgressTitle,resetResumedGenerationTaskCache,setGenerationTaskSettledHandler,setGenerationTaskSucceededHandler } from '../../../generationTask';
import { snapGridSplitNodePosition } from '../../../gridSplitUtils';
import type { CanvasAssetDragPayload,CanvasGraph,CanvasNodeData,TextEditorApi } from '.././sharedImports';
import { addCanvasNode,api,applyCanvasBgTheme,applyRemoteImageToNode,applyRemoteVideoToNode,assignGroupId,bindGraphInteraction,cancelPendingCanvasSnapshotStorage,createCanvasHistory,createGraph,ensureInfiniteCanvasArea,fitStoredGroupSelectionBoxToMembers,getNodeSize,getRandomViewportLocalPoint,getScroller,parseElementGroupRecord,planOutgoingResultPoints,refreshCanvasNodeViews,runUploadSimulation,setCanvasNodeMutationCompleteHandler,setCanvasUploadCompleteHandler,setCanvasUploadProjectId,setGroupTitle,startImageNodeCornerResize,syncAllNodeSizes,syncImageNodeSizeToMediaAspect,useCanvasKeyboard } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installGraphLifecycle(ctx: CoreRuntimeContext) {
  Object.assign(ctx, useCanvasKeyboard({
      graph: ctx.graph,
      panMode: ctx.panMode,
      selectedNodeId: ctx.selectedNodeId,
      cancelCurrentOperation: ctx.cancelCurrentOperation,
      zoomIn: ctx.zoomIn,
      zoomOut: ctx.zoomOut,
      zoomToScale: ctx.zoomToScale,
      zoomFitToScreen: ctx.zoomFitToScreen,
      handleSaveCanvas: ctx.handleSaveCanvas,
      copySelectedNode: ctx.copySelectedNode,
      pasteNode: ctx.pasteNode,
      handleUndo: ctx.handleUndo,
      handleRedo: ctx.handleRedo,
      moveNodeLayer: ctx.moveNodeLayer,
      openImageDialogue: ctx.openImageDialogue,
      getSelectedNode: ctx.getSelectedNode,
      removeSelectedNodes: ctx.removeSelectedNodes,
      removeSelectedEdge: ctx.removeSelectedEdge,
      removeSelectedElementMark: ctx.removeSelectedElementMark,
      hasSelectedNodes: () => ctx.getGraphSelectedNodeIds().length > 0 || Boolean(ctx.selectedNodeId.value),
      hasSelectedEdge: () => Boolean(ctx.selectedEdgeId.value),
      openImagePreview: ctx.openImagePreview,
      triggerCanvasUploadShortcut: ctx.triggerCanvasUploadShortcut,
      getScroller,
      setRubberbandEnabled: ctx.setRubberbandEnabled,
      isGroupBlankDragTarget: (clientX, clientY) => Boolean(ctx.findGroupBlankAreaAtClientPoint(clientX, clientY)),
      isNodeInteractionPointerTarget: ctx.isGraphNodePointerTarget,
  }));
  
  ctx.onScrollerScroll = function onScrollerScroll() {
      ctx.scheduleUpdateNodeToolbar({ skipImageResizeOverlay: true });
      ctx.updateImageResizeOverlay();
      ctx.updateEdgeDeleteButtonPosition();
      ctx.scheduleViewportNodeVisibilitySync();
  };
  
  ctx.bindScrollerScrollListener = function bindScrollerScrollListener(g: Graph) {
      const scroller = getScroller(g);
      if (!scroller)
          return;
      ctx.scrollerScrollTarget = scroller.container;
      ctx.scrollerScrollTarget.addEventListener('scroll', ctx.onScrollerScroll, { passive: true });
  };
  
  ctx.unbindScrollerScrollListener = function unbindScrollerScrollListener() {
      if (!ctx.scrollerScrollTarget)
          return;
      ctx.scrollerScrollTarget.removeEventListener('scroll', ctx.onScrollerScroll);
      ctx.scrollerScrollTarget = null;
  };
  
  onMounted(() => {
      ctx.autoSaveEnabled = true;
      ctx.canvasContentReady = false;
      const resumeAutoSaveIfAlive = () => {
          // pagehide/beforeunload 只 pause；回到前台恢复自动保存，并自愈 contentReady
          if (!ctx.graph.value)
              return;
          ctx.autoSaveEnabled = true;
          if (typeof ctx.ensureCanvasReadyForAutoSave === 'function') {
              ctx.ensureCanvasReadyForAutoSave();
          }
          else if (ctx.activeProjectId.value) {
              ctx.canvasContentReady = true;
          }
      };
      ctx.onPageShow = function onPageShow() {
          resumeAutoSaveIfAlive();
      };
      ctx.onVisibilityChange = function onVisibilityChange() {
          if (document.visibilityState === 'visible') {
              resumeAutoSaveIfAlive();
          }
      };
      window.addEventListener('beforeunload', ctx.onPageUnload);
      window.addEventListener('pagehide', ctx.onPageUnload);
      window.addEventListener('pageshow', ctx.onPageShow);
      document.addEventListener('visibilitychange', ctx.onVisibilityChange);
      setCanvasUploadProjectId(() => ctx.activeProjectId.value || undefined);
      setCanvasNodeMutationCompleteHandler(() => {
          ctx.scheduleHistoryPush();
      });
      setCanvasUploadCompleteHandler(({ fileName }) => {
          ctx.recordUploadCanvasDescription(fileName);
      });
      setGenerationTaskSucceededHandler(() => {
          ctx.scheduleHistoryPush();
      });
      setGenerationTaskSettledHandler(() => {
          ctx.persistGenerationTaskBinding();
      });
      void ctx.onLoadProjects();
      const routeProjectId = ctx.router.currentRoute.value.params.id;
      const normalizedRouteId = typeof routeProjectId === 'string'
          ? routeProjectId.trim()
          : Array.isArray(routeProjectId)
              ? String(routeProjectId[0] ?? '').trim()
              : '';
      if (normalizedRouteId) {
          ctx.activeProjectId.value = normalizedRouteId;
      }
      if (!ctx.graphRef.value)
          return;
      const instance = createGraph(ctx.graphRef.value) as CanvasGraph;
      instance.__openConnectMenu = ctx.openConnectMenuByNodeId;
      instance.__openImageDialogue = ctx.openImageDialogue;
      instance.__removeImageElementMark = ctx.removeElementMark;
      instance.__selectImageElementMark = ctx.selectElementMark;
      instance.__openImageContextMenu = ctx.openMediaContextMenu;
      instance.__openMediaContextMenu = ctx.openMediaContextMenu;
      instance.__openVideoDialogue = ctx.openVideoDialogue;
      instance.__primarySelectedNodeId = () => ctx.selectedNodeId.value;
      instance.__startImageNodeCornerResize = (event, corner) => {
          const g = ctx.graph.value;
          const id = ctx.selectedNodeId.value;
          if (!g || !id)
              return;
          const cell = g.getCellById(id);
          if (!cell?.isNode())
              return;
          startImageNodeCornerResize(g, cell as Node, event, corner, () => {
              ctx.bumpToolbarRevision();
              ctx.scheduleUpdateNodeToolbar({ skipImageResizeOverlay: true });
          });
      };
      instance.__deleteCanvasNode = ctx.removeNodeById;
      instance.__uploadFileToCanvasNode = ctx.uploadFileToCanvasNode;
      instance.__requestCanvasUpload = ctx.requestCanvasUpload;
      instance.__requestTextExpand = ctx.openTextExpand;
      instance.__onTextPickerAction = ctx.handleTextPickerAction;
      instance.__onVideoPickerAction = ctx.handleVideoPickerAction;
      instance.__onTextNodeEdgeLinked = ctx.handleNodeEdgeLinked;
      instance.__onNodeEdgeLinked = ctx.handleNodeEdgeLinked;
      instance.__notifyTextNodeUpdated = ctx.notifyTextNodeUpdated;
      instance.__focusCanvasNode = (nodeId: string) => {
          const g = ctx.graph.value;
          if (!g)
              return;
          const cell = g.getCellById(nodeId);
          if (!cell?.isNode())
              return;
          ctx.selectGraphNodes(cell as Node);
      };
      instance.__onTextEditorFocus = (nodeId: string) => {
          if (ctx.selectedNodeId.value && ctx.selectedNodeId.value !== nodeId)
              return;
          ctx.selectedNodeId.value = nodeId;
          ctx.selectedKind.value = 'text';
          ctx.setTextEditorToolbarActive(true);
          ctx.updateNodeToolbar();
      };
      instance.__deactivateTextEditorToolbar = () => {
          ctx.setTextEditorToolbarActive(false);
      };
      instance.__notifyNodeDragMove = ctx.scheduleUpdateNodeToolbar;
      instance.__notifyNodeDragEnd = () => {
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
      };
      instance.__textEditorRegistry = {
          register(nodeId: string, api: TextEditorApi) {
              ctx.textEditorApis.set(nodeId, api);
          },
          unregister(nodeId: string) {
              ctx.textEditorApis.delete(nodeId);
          },
          get(nodeId: string) {
              return ctx.textEditorApis.get(nodeId);
          },
      };
      ctx.graph.value = instance;
      bindGraphInteraction(instance);
      ctx.bindScrollerScrollListener(instance);
      ctx.bindKeyboard();
      instance.on('blank:dblclick', ctx.handleBlankDblClick);
      instance.on('blank:mousedown', ctx.handleGroupBlankMouseDown);
      ctx.bindLongPressPan(instance);
      // 挂载即把全画布各层背景刷成当前主题色，避免拖拽到内容区外露出建图时的深色底（视图分层感）
      applyCanvasBgTheme(instance, ctx.canvasBgTheme.value, ctx.gridVisible.value);
      instance.on('scale', ({ sx }: {
          sx: number;
      }) => {
          ctx.syncZoom(sx);
          ctx.updateEdgeDeleteButtonPosition();
          ctx.scheduleViewportNodeVisibilitySync();
          ctx.scheduleUpdateNodeToolbar({ skipImageResizeOverlay: true });
          ctx.updateImageResizeOverlay();
      });
      instance.on('translate', () => {
          ctx.updateEdgeDeleteButtonPosition();
          ctx.scheduleViewportNodeVisibilitySync();
          ctx.scheduleUpdateNodeToolbar({ skipImageResizeOverlay: true });
          ctx.updateImageResizeOverlay();
      });
      instance.on('node:moving', ({ node }) => {
          ctx.syncGroupedNodeMove(node);
          snapGridSplitNodePosition(instance, node);
          ctx.groupMoveState.draggingNodeId = node.id;
          ctx.updateGroupToolbarPosition();
          ctx.scheduleUpdateNodeToolbar();
          ctx.updateEdgeDeleteButtonPosition();
      });
      instance.on('node:moved', ({ node }) => {
          snapGridSplitNodePosition(instance, node);
          const draggedByUser = ctx.groupMoveState.draggingNodeId === node.id;
          ctx.groupMoveState.anchorId = '';
          ctx.groupMoveState.draggingNodeId = '';
          if (draggedByUser) {
              ctx.handleGroupedNodeMoved(node);
          }
          ctx.updateNodeToolbar();
          ctx.syncViewportNodeVisibility();
          ctx.scheduleHistoryPush();
      });
      instance.on('node:added', ctx.syncNodeCount);
      instance.on('node:removed', ctx.syncNodeCount);
      instance.on('node:click', ctx.handleNodeClick);
      instance.on('node:mousedown', ({ node, e }: {
          node: Node;
          e: MouseEvent;
      }) => {
          if (e.button !== 0)
              return;
          if (e.ctrlKey || e.metaKey || e.shiftKey)
              return;
          if (ctx.showVideoGenCanvasPickMode.value ||
              ctx.showImageDialogueCanvasPickMode.value ||
              ctx.showElementSelectMode.value) {
              return;
          }
          const g = ctx.graph.value;
          if (!g)
              return;
          const ids = ctx.getGraphSelectedNodeIds();
          if (ids.length === 1 && ids[0] === node.id)
              return;
          ctx.selectSingleGraphNode(node);
      });
      instance.on('edge:click', ctx.handleEdgeClick);
      instance.on('edge:mouseenter', ctx.handleEdgeMouseEnter);
      instance.on('edge:mouseleave', ctx.handleEdgeMouseLeave);
      instance.on('selection:changed', () => {
          if (ctx.showVideoGenCanvasPickMode.value || ctx.showImageDialogueCanvasPickMode.value) {
              ctx.restoreCanvasPickTargetSelection();
              return;
          }
          const g = ctx.graph.value;
          if (!g) {
              ctx.syncSelectionFromGraph();
              return;
          }
          // 始终刷新组框，确保打组框不依赖选中状态
          ctx.syncSelectionFromGraph();
          nextTick(() => {
              ctx.updateGroupToolbarPosition();
              if (ctx.showMultiSelectToolbar.value) {
                  ctx.updateMultiSelectToolbarPosition();
              }
              const gAfter = ctx.graph.value;
              const selectedId = ctx.selectedNodeId.value;
              if (gAfter && selectedId && ctx.getGraphSelectedNodeIds().length === 1) {
                  const cell = gAfter.getCellById(selectedId);
                  if (cell?.isNode()) {
                      syncImageNodeSizeToMediaAspect(cell as Node);
                  }
              }
              ctx.updateImageResizeOverlay();
          });
      });
      instance.on('node:resized', ({ node }: {
          node: Node;
      }) => {
          const g = ctx.graph.value;
          if (g) {
              const groupId = (node.getData() as CanvasNodeData).groupId;
              if (groupId) {
                  fitStoredGroupSelectionBoxToMembers(g, groupId);
              }
          }
          ctx.scheduleHistoryPush();
          ctx.bumpToolbarRevision();
          ctx.updateImageResizeOverlay();
      });
      instance.on('node:dblclick', ({ node }) => {
          const data = node.getData() as CanvasNodeData;
          if (data.kind === 'image') {
              ctx.handleImageNodeDblClick({ node });
              return;
          }
          if (data.kind === 'video') {
              ctx.handleVideoNodeDblClick({ node });
              return;
          }
          if (data.kind === 'text' && data.mode === 'picker') {
              node.setData({ ...data, mode: 'editor', promptBarPinned: false });
              ctx.selectGraphNodes(node);
              ctx.setTextEditorToolbarActive(false);
              ctx.bumpToolbarRevision();
          }
      });
      instance.on('node:contextmenu', ({ node, e }: {
          node: Node;
          e: MouseEvent;
      }) => {
          const data = node.getData() as CanvasNodeData;
          if (!ctx.canOpenMediaContextMenu(data))
              return;
          ctx.handleMediaNodeContextMenu(node.id, e.clientX, e.clientY, e);
      });
      instance.on('blank:contextmenu', ({ e }: {
          e: MouseEvent;
      }) => {
          const node = ctx.findMediaNodeAtClientPoint(e.clientX, e.clientY);
          if (!node)
              return;
          ctx.handleMediaNodeContextMenu(node.id, e.clientX, e.clientY, e);
      });
      ctx.canvasRef.value?.addEventListener('contextmenu', ctx.onCanvasImageContextMenuCapture, true);
      ctx.canvasRef.value?.addEventListener('mousemove', ctx.onCanvasGroupBlankPointerMove);
      ctx.canvasRef.value?.addEventListener('mouseleave', ctx.resetGroupBlankHoverCursor);
      instance.on('blank:click', ({ e }: {
          e: MouseEvent;
      }) => {
          ctx.clearImageElementMarkSelection();
          const groupId = ctx.findGroupIdAtContainerPoint(e.clientX, e.clientY);
          if (groupId) {
              ctx.onGroupOverlaySelectGroup(groupId);
              return;
          }
          ctx.dismissOneCanvasLayer();
      });
      instance.on('node:change:data', ctx.handleNodeDataChange);
      instance.on('edge:connected', ctx.handleEdgeConnected);
      ctx.canvasHistory = createCanvasHistory(ctx.getHistoryMeta);
      ctx.canvasHistory.seed(instance);
      ctx.syncHistoryState();
      resetResumedGenerationTaskCache();
      const scroller = getScroller(instance);
      scroller?.togglePanning(ctx.panMode.value);
      ctx.setRubberbandEnabled(!ctx.panMode.value);
      ctx.syncZoom();
      ctx.syncNodeCount();
      nextTick(() => {
          syncAllNodeSizes(instance);
          refreshCanvasNodeViews(instance);
          ensureInfiniteCanvasArea(instance, { recenter: true });
          ctx.syncViewportNodeVisibility();
          if (ctx.pendingProjectCanvas) {
              const pending = ctx.pendingProjectCanvas;
              const loaded = ctx.applyProjectCanvasPayload(pending);
              ctx.pendingProjectCanvas = null;
              if (loaded) {
                  ctx.markCanvasContentReady();
              }
              else {
                  // 仅在与当前路由一致（或无路由约束）时绑定，避免过期 pending 改写活动项目
                  const pendingId = pending.projectId != null ? String(pending.projectId).trim() : '';
                  const routeProjectId = ctx.router?.currentRoute?.value?.params?.id;
                  const routeId = typeof routeProjectId === 'string'
                      ? routeProjectId.trim()
                      : Array.isArray(routeProjectId)
                          ? String(routeProjectId[0] ?? '').trim()
                          : '';
                  if (pendingId && (!routeId || pendingId === routeId)) {
                      ctx.activeProjectId.value = pendingId;
                      if (typeof pending.revision === 'number') {
                          ctx.canvasRevision.value = pending.revision;
                      }
                      ctx.markCanvasContentReady();
                  }
              }
          }
      });
      if (ctx.showMinimap.value) {
          nextTick(() => ctx.setupMinimap());
      }
      ctx.bindGraphDropListeners(ctx.graphRef.value);
      setCanvasAssetDropHandler(ctx.handleCanvasAssetDrop);
  });
  
  ctx.waitForNodeUploadDone = function waitForNodeUploadDone(node: Node) {
      const data = node.getData() as CanvasNodeData;
      if (data.uploadState === 'done' && data.previewUrl) {
          return Promise.resolve(node);
      }
      return new Promise<Node>((resolve) => {
          const handler = () => {
              const current = node.getData() as CanvasNodeData;
              if (current.uploadState === 'done' && current.previewUrl) {
                  node.off('change:data', handler);
                  resolve(node);
              }
          };
          node.on('change:data', handler);
      });
  };
  
  ctx.createNodeFromChatTask = function createNodeFromChatTask(payload: ChatTaskCreatedPayload) {
      const g = ctx.graph.value;
      if (!g)
          return null;
      const taskId = String(payload.taskId ?? '').trim();
      if (!taskId)
          return null;
      const existing = resolveChatTaskTargetNode(g, payload);
      if (existing) {
          attachChatTaskToNode(g, existing, payload, {
              onError: (reason) => message.error(reason),
              onComplete: () => {
                  ctx.syncNodeCount();
                  ctx.scheduleHistoryPush();
              },
              toHtml: ctx.plainTextToEditorHtml,
          });
          ctx.scheduleHistoryPush();
          return existing;
      }
      const taskType = normalizeChatTaskType(payload.taskType);
      const title = resolveChatTaskTitle(payload);
      const taskTitleFields = isGenerationProgressTitle(title)
          ? { title }
          : { title, generationTaskName: title };
      const prompt = String(payload.prompt || '').trim();
      const parentNodeId = String(payload.parentNodeId ?? '').trim();
      const parentCell = parentNodeId ? g.getCellById(parentNodeId) : null;
      const parentNode = parentCell?.isNode() ? (parentCell as Node) : null;
      const parentData = parentNode
          ? (parentNode.getData() as CanvasNodeData)
          : null;
      const sourceOverrides: Partial<CanvasNodeData> = parentNode && parentData
          ? {
              sourceNodeId: parentNode.id,
              sourcePreviewUrl: parentData.previewUrl ?? '',
              sourceFileName: parentData.fileName ?? '',
              sourceAssetId: parentData.assetId,
              inputUpdated: Boolean(parentData.previewUrl),
          }
          : {};
      const preferredNodeId = String(payload.nodeId ?? '').trim();
      const canUsePreferredId = Boolean(preferredNodeId)
          && preferredNodeId !== '字符串值'
          && !g.getCellById(preferredNodeId);
      const center = ctx.getGraphCenter();
      const stacking = g.getNodes().filter((node) => {
          const data = node.getData() as CanvasNodeData;
          return (data.imageGenState === 'loading'
              || data.textGenState === 'loading'
              || data.uploadState === 'uploading');
      }).length;
      const fallbackPoint = { x: center.x + stacking * 48, y: center.y + stacking * 36 };
      const nodeOptions = canUsePreferredId ? { id: preferredNodeId } : undefined;
      let node: Node;
      if (taskType === 'VIDEO') {
          const overrides: Partial<CanvasNodeData> = {
              mode: 'editor',
              uploadState: 'uploading',
              uploadProgress: 0,
              generationTaskType: 'VIDEO',
              ...taskTitleFields,
              fileName: `${title}.mp4`,
              previewUrl: '',
              genPrompt: prompt,
              videoDialogueText: prompt,
              ...sourceOverrides,
          };
          const size = getNodeSize('video', 'editor', overrides);
          const point = parentNode
              ? planOutgoingResultPoints(g, parentNode, size, 1, 'right')[0] || fallbackPoint
              : fallbackPoint;
          node = addCanvasNode(g, 'video', point, overrides, nodeOptions);
      }
      else if (taskType === 'TEXT') {
          const overrides: Partial<CanvasNodeData> = {
              mode: 'editor',
              textGenState: 'loading',
              textGenProgress: 0,
              generationTaskType: 'TEXT',
              ...taskTitleFields,
              content: '',
              genPrompt: prompt,
              ...sourceOverrides,
          };
          const size = getNodeSize('text', 'editor', overrides);
          const point = parentNode
              ? planOutgoingResultPoints(g, parentNode, size, 1, 'right')[0] || fallbackPoint
              : fallbackPoint;
          node = addCanvasNode(g, 'text', point, overrides, nodeOptions);
      }
      else if (taskType === 'MODEL') {
          const overrides: Partial<CanvasNodeData> = {
              mode: 'editor',
              imageGenState: 'loading',
              imageGenProgress: 0,
              generationTaskType: 'MODEL',
              ...taskTitleFields,
              fileName: `${title}.glb`,
              previewUrl: '',
              mediaWidth: 320,
              mediaHeight: 360,
              genPrompt: prompt,
              ...sourceOverrides,
          };
          const size = getNodeSize('model3d', 'editor', overrides);
          const point = parentNode
              ? planOutgoingResultPoints(g, parentNode, size, 1, 'right')[0] || fallbackPoint
              : fallbackPoint;
          node = addCanvasNode(g, 'model3d', point, overrides, nodeOptions);
      }
      else {
          const overrides: Partial<CanvasNodeData> = {
              mode: 'editor',
              imageGenTask: 'picker',
              imageGenState: 'loading',
              imageGenProgress: 0,
              generationTaskType: 'IMAGE',
              ...taskTitleFields,
              fileName: `${title}.png`,
              previewUrl: '',
              genPrompt: prompt,
              ...sourceOverrides,
          };
          const size = getNodeSize('image', 'editor', overrides);
          const point = parentNode
              ? planOutgoingResultPoints(g, parentNode, size, 1, 'right')[0] || fallbackPoint
              : fallbackPoint;
          node = addCanvasNode(g, 'image', point, overrides, nodeOptions);
      }
      followChatGenerationTaskOnNode(node, payload, {
          onError: (reason) => message.error(reason),
          onComplete: () => {
              ctx.syncNodeCount();
              ctx.scheduleHistoryPush();
          },
          toHtml: ctx.plainTextToEditorHtml,
      });
      linkChatTaskNodeToParent(g, node, parentNodeId);
      ctx.selectGraphNodes(node);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      ensureInfiniteCanvasArea(g);
      return node;
  };
  
  ctx.updateChatTaskNodeTitleFromPayload = function updateChatTaskNodeTitleFromPayload(payload: ChatTaskUpdatedPayload) {
      const g = ctx.graph.value;
      if (!g)
          return;
      updateChatTaskNodeTitle(g, payload);
      ctx.scheduleHistoryPush();
  };
  
  ctx.addImageFromFile = function addImageFromFile(file: File, point?: {
      x: number;
      y: number;
  }, options: {
      select?: boolean;
  } = {}) {
      const g = ctx.graph.value;
      if (!g)
          return Promise.resolve(null);
      const position = point ?? ctx.getGraphCenter();
      const node = addCanvasNode(g, 'image', position, {
          mode: 'editor',
          title: file.name,
          fileName: file.name,
      });
      runUploadSimulation(node, file);
      if (options.select !== false) {
          ctx.selectGraphNodes(node);
      }
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush({ autoSave: false });
      return ctx.waitForNodeUploadDone(node);
  };
  
  ctx.addElementGroupFromRecord = function addElementGroupFromRecord(record: Record<string, unknown>, point?: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      if (!g)
          return;
      if (!parseElementGroupRecord(record)) {
          message.warning('无法解析该技能数据');
          return;
      }
      const anchor = point ?? getRandomViewportLocalPoint(g);
      const nodes = addElementGroupRecordToCanvas(g, record, anchor);
      if (!nodes.length) {
          message.warning('无法解析该技能数据');
          return;
      }
      const ids = nodes.map((node) => node.id);
      if (ids.length >= 2) {
          const groupId = assignGroupId(g, ids);
          if (groupId) {
              fitStoredGroupSelectionBoxToMembers(g, groupId);
              const title = String(record.name ?? record.projectName ?? '').trim();
              if (title) {
                  setGroupTitle(g, groupId, title);
              }
          }
      }
      ctx.selectGraphNodes(ids);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      ensureInfiniteCanvasArea(g);
  };
  
  ctx.resolveLibraryAssetBindId = function resolveLibraryAssetBindId(asset: {
      assetId?: string | number | null;
      id?: string | number | null;
  }) {
      return normalizeAssetId(asset.assetId) || normalizeAssetId(asset.id) || undefined;
  };
  
  ctx.addImageFromAsset = function addImageFromAsset(asset: {
      assetId?: string;
      id?: string | number;
      previewUrl: string;
      fileName?: string;
      width?: number | null;
      height?: number | null;
  }, point?: {
      x: number;
      y: number;
  }): Node | null {
      const g = ctx.graph.value;
      if (!g || !asset.previewUrl)
          return null;
      const position = point ?? getRandomViewportLocalPoint(g, { kind: 'image', mode: 'editor' });
      const boundAssetId = ctx.resolveLibraryAssetBindId(asset);
      const node = addCanvasNode(g, 'image', position, {
          mode: 'editor',
          title: asset.fileName || '图片',
          fileName: asset.fileName || '图片',
          ...(boundAssetId ? { assetId: boundAssetId } : {}),
      });
      void applyRemoteImageToNode(node, {
          ...asset,
          assetId: boundAssetId,
      });
      ctx.selectGraphNodes(node);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      return node;
  };
  
  ctx.addVideoFromAsset = function addVideoFromAsset(asset: {
      assetId?: string;
      id?: string | number;
      previewUrl: string;
      fileName?: string;
      width?: number | null;
      height?: number | null;
  }, point?: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      if (!g || !asset.previewUrl)
          return;
      const position = point ?? getRandomViewportLocalPoint(g, { kind: 'video', mode: 'editor' });
      const boundAssetId = ctx.resolveLibraryAssetBindId(asset);
      const node = addCanvasNode(g, 'video', position, {
          mode: 'editor',
          title: asset.fileName || '视频',
          fileName: asset.fileName || '视频',
          ...(boundAssetId ? { assetId: boundAssetId } : {}),
      });
      void applyRemoteVideoToNode(node, {
          ...asset,
          assetId: boundAssetId,
      });
      ctx.selectGraphNodes(node);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
  };
  
  ctx.batchInsertAssetsFromLibrary = function batchInsertAssetsFromLibrary(assets: CanvasAssetDragPayload[]) {
      const g = ctx.graph.value;
      if (!g)
          return 0;
      const validAssets = assets.filter((asset) => asset.previewUrl);
      if (!validAssets.length)
          return 0;
      const basePoint = ctx.getGraphCenter();
      const createdNodes: Node[] = [];
      validAssets.forEach((asset, index) => {
          const kind = asset.mediaType === 'VIDEO' ? 'video' : 'image';
          const point = ctx.getMultiUploadSpawnPoint(basePoint, index, kind);
          const title = asset.fileName || (kind === 'video' ? '视频' : '图片');
          const boundAssetId = ctx.resolveLibraryAssetBindId(asset);
          const node = addCanvasNode(g, kind, point, {
              mode: 'editor',
              title,
              fileName: title,
              ...(boundAssetId ? { assetId: boundAssetId } : {}),
          });
          const payload = { ...asset, assetId: boundAssetId };
          if (asset.mediaType === 'VIDEO') {
              void applyRemoteVideoToNode(node, payload);
          }
          else {
              void applyRemoteImageToNode(node, payload);
          }
          createdNodes.push(node);
      });
      if (!createdNodes.length)
          return 0;
      ctx.selectGraphNodes(createdNodes);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      ensureInfiniteCanvasArea(g);
      message.success(`已批量插入 ${createdNodes.length} 个素材`);
      return createdNodes.length;
  };
  
  ctx.addImagesFromFiles = async function addImagesFromFiles(files: File[]) {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (!imageFiles.length)
          return [];
      const basePoint = ctx.getGraphCenter();
      const nodes: Node[] = [];
      for (let index = 0; index < imageFiles.length; index += 1) {
          const point = ctx.getMultiUploadSpawnPoint(basePoint, index, 'image');
          const node = await ctx.addImageFromFile(imageFiles[index], point);
          if (node)
              nodes.push(node);
      }
      return nodes;
  };
  
  onBeforeUnmount(() => {
      ctx.hideImageMarkHint();
      cancelAllGenerationTaskPolling();
      cancelPendingCanvasSnapshotStorage();
      if (ctx.toolbarUpdateRaf) {
          window.cancelAnimationFrame(ctx.toolbarUpdateRaf);
          ctx.toolbarUpdateRaf = 0;
      }
      if (ctx.viewportVisibilityRaf) {
          window.cancelAnimationFrame(ctx.viewportVisibilityRaf);
          ctx.viewportVisibilityRaf = 0;
      }
      window.removeEventListener('beforeunload', ctx.onPageUnload);
      window.removeEventListener('pagehide', ctx.onPageUnload);
      if (ctx.onPageShow)
          window.removeEventListener('pageshow', ctx.onPageShow);
      if (ctx.onVisibilityChange)
          document.removeEventListener('visibilitychange', ctx.onVisibilityChange);
      ctx.stopAutoSave();
      setCanvasNodeMutationCompleteHandler(null);
      setCanvasUploadCompleteHandler(null);
      setGenerationTaskSucceededHandler(null);
      setGenerationTaskSettledHandler(null);
      ctx.unbindKeyboard();
      ctx.unbindLongPressPan();
      ctx.unbindGraphDropListeners();
      ctx.canvasRef.value?.removeEventListener('contextmenu', ctx.onCanvasImageContextMenuCapture, true);
      ctx.canvasRef.value?.removeEventListener('mousemove', ctx.onCanvasGroupBlankPointerMove);
      ctx.canvasRef.value?.removeEventListener('mouseleave', ctx.resetGroupBlankHoverCursor);
      ctx.resetGroupBlankHoverCursor();
      ctx.stopGroupOverlayDrag();
      setCanvasAssetDropHandler(null);
      clearCanvasAssetDrag();
      if (ctx.historyPushTimer)
          clearTimeout(ctx.historyPushTimer);
      if (ctx.autoSaveDebounceTimer)
          clearTimeout(ctx.autoSaveDebounceTimer);
      if (ctx.edgeHoverLeaveTimer)
          window.clearTimeout(ctx.edgeHoverLeaveTimer);
      if (ctx.altVoiceTimer.value)
          clearTimeout(ctx.altVoiceTimer.value);
      ctx.canvasHistory = null;
      ctx.unbindScrollerScrollListener();
      ctx.teardownMinimap();
      ctx.graph.value?.dispose();
      ctx.graph.value = null;
  });
  
  ctx.openNewProject = () => {
      api.createProject({ title: '新项目' }).then((_res: unknown) => {
          // router.push({ name: 'createOrEdit', params: { id: res.id } })
      });
  };
}
