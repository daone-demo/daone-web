// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Persistence 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { ProjectCanvasResponse,ProjectVersionDetailResponse } from '@/services/api';
import { isRequestError } from '@/utils/request';
import type { Edge,Node } from '@antv/x6';
import { nextTick,provide } from 'vue';
import { formatCanvasDescription,formatUploadCanvasDescription,resolveCanvasSaveDescription,resolveCanvasSaveType,resolveVideoTaskTypeLabel,} from '../../../canvasDescription';
import { buildProjectCanvasPayloadFromVersionDetail } from '../../../canvasHistoryRecords';
import { resetResumedGenerationTaskCache } from '../../../generationTask';
import type { CanvasGraph,CanvasNodeData,CanvasSnapshot,ConnectMenuKey } from '.././sharedImports';
import { api,applyCanvasBgTheme,applyCanvasSnapshot,applyFlowEdgeStyle,canImageNodeAcceptIncoming,canOpenConnectMenu,CONNECT_GENERATE_MENU,createNodeFromConnectMenu,ensureInfiniteCanvasArea,getCanvasSnapshot,getConnectMenuPosition,getFlowEdgeAttrs,getPreviewEdgeAttrs,getScroller,graphLocalToContainerOffset,hydrateMissingImageNodeDimensions,normalizeCanvasSnapshot,refreshCanvasNodeViews,resolveConnectSpawnPoint,saveCanvasSnapshotToStorage,shouldOpenImageGenPromptBar,syncAllNodeSizes } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installPersistenceState(ctx: CoreRuntimeContext) {
  ctx.autoSaveDebounceTimer = null;
  ctx.autoSaveEnabled = true;
  ctx.canvasContentReady = false;
  ctx.saveInFlight = false;
  ctx.pendingRemoteSaveType = null;
  ctx.pendingProjectCanvas = null;
}

export function installPersistence(ctx: CoreRuntimeContext) {
  ctx.recordCanvasDescription = function recordCanvasDescription(description: string, taskType?: string) {
      const formatted = formatCanvasDescription(taskType ?? '', description);
      if (formatted) {
          ctx.lastCanvasDescription.value = formatted;
      }
  };
  
  ctx.recordUploadCanvasDescription = function recordUploadCanvasDescription(resourceName: string) {
      const formatted = formatUploadCanvasDescription(resourceName);
      if (formatted) {
          ctx.lastCanvasDescription.value = formatted;
      }
  };
  
  ctx.setCanvasDescription = function setCanvasDescription(description: string, taskType = '对话') {
      const formatted = formatCanvasDescription(taskType, description);
      if (formatted) {
          ctx.lastCanvasDescription.value = formatted;
      }
  };
  
  ctx.applyProjectCanvasPayload = function applyProjectCanvasPayload(payload: ProjectCanvasResponse) {
      const g = ctx.graph.value;
      if (!g)
          return false;
      resetResumedGenerationTaskCache();
      const canvasData = payload.canvasData ?? payload.canvas;
      if (!canvasData)
          return false;
      ctx.activeProjectId.value = payload.projectId;
      ctx.canvasRevision.value = payload.revision;
      ctx.lastCanvasDescription.value = payload.description?.trim() || '';
      const snapshot = normalizeCanvasSnapshot(canvasData as Partial<CanvasSnapshot>, {
          projectId: payload.projectId,
          projectName: canvasData.meta?.projectName ?? '未命名创作',
      });
      ctx.upsertCanvasProject(payload.projectId, snapshot.meta.projectName, true);
      if (snapshot.meta.canvasBgTheme === 'dark' || snapshot.meta.canvasBgTheme === 'light') {
          ctx.canvasBgTheme.value = snapshot.meta.canvasBgTheme;
      }
      ctx.gridVisible.value = snapshot.meta.gridVisible;
      ctx.panMode.value = snapshot.meta.panMode;
      ctx.showMinimap.value = snapshot.meta.showMinimap;
      applyCanvasBgTheme(g, ctx.canvasBgTheme.value, ctx.gridVisible.value);
      applyCanvasSnapshot(g, snapshot);
      getScroller(g)?.togglePanning(ctx.panMode.value);
      ctx.setRubberbandEnabled(!ctx.panMode.value);
      if (ctx.showMinimap.value) {
          ctx.setupMinimap();
      }
      else {
          ctx.teardownMinimap();
      }
      ctx.syncNodeCount();
      ctx.syncZoom();
      ctx.canvasHistory?.seed(g);
      ctx.syncHistoryState();
      nextTick(() => {
          syncAllNodeSizes(g);
          refreshCanvasNodeViews(g);
          ensureInfiniteCanvasArea(g);
          ctx.syncViewportNodeVisibility();
          ctx.updateNodeToolbar();
          ctx.bumpToolbarRevision();
          ctx.resumeCanvasGenerationTasks();
          void hydrateMissingImageNodeDimensions(g).finally(() => {
              syncAllNodeSizes(g);
              refreshCanvasNodeViews(g);
              ensureInfiniteCanvasArea(g);
              ctx.syncViewportNodeVisibility();
              ctx.updateNodeToolbar();
              ctx.bumpToolbarRevision();
          });
      });
      return true;
  };
  
  ctx.stopAutoSave = function stopAutoSave() {
      ctx.autoSaveEnabled = false;
      ctx.canvasContentReady = false;
      if (ctx.autoSaveDebounceTimer) {
          clearTimeout(ctx.autoSaveDebounceTimer);
          ctx.autoSaveDebounceTimer = null;
      }
      ctx.pendingRemoteSaveType = null;
  };
  
  ctx.triggerAutoSaveIfReady = function triggerAutoSaveIfReady() {
      if (!ctx.autoSaveEnabled || !ctx.canvasContentReady)
          return;
      if (ctx.autoSaveDebounceTimer)
          clearTimeout(ctx.autoSaveDebounceTimer);
      ctx.autoSaveDebounceTimer = setTimeout(() => {
          ctx.autoSaveDebounceTimer = null;
          ctx.handleSaveCanvas('AUTO');
      }, 280);
  };
  
  ctx.markCanvasContentReady = function markCanvasContentReady() {
      ctx.canvasContentReady = true;
  };
  
  ctx.onPageUnload = function onPageUnload() {
      ctx.stopAutoSave();
  };
  
  ctx.loadProjectCanvas = function loadProjectCanvas(payload: ProjectCanvasResponse) {
      ctx.pendingProjectCanvas = payload;
      const loaded = ctx.applyProjectCanvasPayload(payload);
      if (loaded) {
          ctx.pendingProjectCanvas = null;
          ctx.markCanvasContentReady();
      }
      return loaded;
  };
  
  ctx.loadProjectCanvasFromVersion = function loadProjectCanvasFromVersion(detail: ProjectVersionDetailResponse) {
      const projectId = ctx.activeProjectId.value;
      if (!projectId)
          return false;
      const payload = buildProjectCanvasPayloadFromVersionDetail(detail, projectId, ctx.canvasRevision.value);
      if (!payload)
          return false;
      ctx.resetCanvasInteractionState();
      const loaded = ctx.applyProjectCanvasPayload(payload);
      if (!loaded)
          return false;
      ctx.markCanvasContentReady();
      const project = ctx.canvasProjects.value.find((item) => item.id === projectId);
      if (project)
          project.saved = false;
      ctx.scheduleHistoryPush({ autoSave: false });
      return true;
  };
  
  ctx.buildCanvasSnapshot = function buildCanvasSnapshot(): CanvasSnapshot | null {
      const g = ctx.graph.value;
      if (!g)
          return null;
      ctx.persistImageDialogueFields();
      ctx.persistVideoDialogueFields();
      return getCanvasSnapshot(g, {
          projectId: ctx.activeProjectId.value,
          projectName: ctx.currentProjectName.value,
          canvasBgTheme: ctx.canvasBgTheme.value,
          gridVisible: ctx.gridVisible.value,
          panMode: ctx.panMode.value,
          showMinimap: ctx.showMinimap.value,
      });
  };
  
  ctx.mergePendingSaveType = function mergePendingSaveType(saveType: 'MANUAL' | 'AUTO'): 'MANUAL' | 'AUTO' {
      if (ctx.pendingRemoteSaveType === 'MANUAL' || saveType === 'MANUAL')
          return 'MANUAL';
      return 'AUTO';
  };
  
  ctx.extractLatestRevision = function extractLatestRevision(error: unknown): number | null {
      if (!isRequestError(error))
          return null;
      if (error.code !== 'CANVAS_REVISION_CONFLICT')
          return null;
      const data = error.data;
      if (data == null || typeof data !== 'object')
          return null;
      const latestRevision = (data as {
          latestRevision?: unknown;
      }).latestRevision;
      return typeof latestRevision === 'number' ? latestRevision : null;
  };
  
  ctx.persistCanvasToServer = async function persistCanvasToServer(projectId: string, snapshot: CanvasSnapshot, saveType: 'MANUAL' | 'AUTO', project?: (typeof ctx.canvasProjects.value)[number]) {
      const sendSave = (revision: number, canvasSnapshot: CanvasSnapshot) => {
          const description = resolveCanvasSaveDescription(ctx.graph.value) ||
              ctx.lastCanvasDescription.value ||
              undefined;
          const type = resolveCanvasSaveType(ctx.graph.value);
          return api.saveProjectCanvas(projectId, {
              revision,
              saveType,
              canvasData: canvasSnapshot,
              description,
              type,
          });
      };
      try {
          const res = await sendSave(ctx.canvasRevision.value, snapshot);
          if (typeof res.revision === 'number') {
              ctx.canvasRevision.value = res.revision;
          }
          if (project)
              project.saved = true;
          return;
      }
      catch (error) {
          const latestRevision = ctx.extractLatestRevision(error);
          if (latestRevision == null)
              throw error;
          ctx.canvasRevision.value = latestRevision;
          const freshSnapshot = ctx.buildCanvasSnapshot() ?? snapshot;
          const res = await sendSave(ctx.canvasRevision.value, freshSnapshot);
          if (typeof res.revision === 'number') {
              ctx.canvasRevision.value = res.revision;
          }
          if (project)
              project.saved = true;
      }
  };
  
  ctx.flushRemoteCanvasSave = async function flushRemoteCanvasSave(saveType: 'MANUAL' | 'AUTO', reusedSnapshot?: CanvasSnapshot | null) {
      if (!ctx.autoSaveEnabled)
          return;
      if (saveType === 'AUTO' && !ctx.canvasContentReady)
          return;
      if (ctx.saveInFlight) {
          ctx.pendingRemoteSaveType = ctx.mergePendingSaveType(saveType);
          return;
      }
      const projectId = ctx.activeProjectId.value;
      if (!projectId)
          return;
      const snapshot = reusedSnapshot ?? ctx.buildCanvasSnapshot();
      if (!snapshot)
          return;
      const project = ctx.canvasProjects.value.find((item) => item.id === projectId);
      ctx.saveInFlight = true;
      ctx.pendingRemoteSaveType = null;
      try {
          if (!ctx.autoSaveEnabled)
              return;
          await ctx.persistCanvasToServer(projectId, snapshot, saveType, project);
      }
      catch (error) {
          console.error('[Canvas] save to server failed', error);
          if (project)
              project.saved = false;
      }
      finally {
          ctx.saveInFlight = false;
          if (ctx.pendingRemoteSaveType && ctx.autoSaveEnabled) {
              const nextSaveType = ctx.pendingRemoteSaveType;
              ctx.pendingRemoteSaveType = null;
              void ctx.flushRemoteCanvasSave(nextSaveType);
          }
      }
  };
  
  ctx.handleSaveCanvas = function handleSaveCanvas(saveType: 'MANUAL' | 'AUTO' = 'MANUAL') {
      if (!ctx.autoSaveEnabled)
          return;
      if (saveType === 'AUTO' && !ctx.canvasContentReady)
          return;
      const snapshot = ctx.buildCanvasSnapshot();
      if (!snapshot)
          return;
      saveCanvasSnapshotToStorage(snapshot);
      const projectId = ctx.activeProjectId.value;
      const project = ctx.canvasProjects.value.find((item) => item.id === projectId);
      if (project) {
          project.saved = false;
      }
      if (!projectId) {
          if (saveType === 'MANUAL') {
              console.warn('[Canvas] skip remote save: missing projectId');
          }
          return;
      }
      void ctx.flushRemoteCanvasSave(saveType, snapshot);
  };
  
  ctx.hasUnsavedChanges = function hasUnsavedChanges() {
      const projectId = ctx.activeProjectId.value;
      if (!projectId)
          return false;
      if (ctx.saveInFlight || ctx.pendingRemoteSaveType)
          return true;
      const project = ctx.canvasProjects.value.find((item) => item.id === projectId);
      return project?.saved === false;
  };
  
  ctx.waitForSaveSettled = function waitForSaveSettled(maxWaitMs = 30000): Promise<void> {
      return new Promise((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
              if (!ctx.saveInFlight && !ctx.pendingRemoteSaveType) {
                  resolve();
                  return;
              }
              if (Date.now() - start > maxWaitMs) {
                  reject(new Error('Canvas save timeout'));
                  return;
              }
              setTimeout(tick, 50);
          };
          tick();
      });
  };
  
  ctx.saveCanvasAndWait = 
  /** 触发保存并等待远端落库完成 */
  async function saveCanvasAndWait(saveType: 'MANUAL' | 'AUTO' = 'MANUAL'): Promise<boolean> {
      if (!ctx.hasUnsavedChanges())
          return true;
      try {
          ctx.handleSaveCanvas(saveType);
          await ctx.waitForSaveSettled();
          return !ctx.hasUnsavedChanges();
      }
      catch (error) {
          console.error('[Canvas] saveCanvasAndWait failed', error);
          return false;
      }
  };
  
  ctx.inferGenerationTaskDescriptionFromNode = function inferGenerationTaskDescriptionFromNode(node: Node) {
      const data = node.getData() as CanvasNodeData;
      const title = data.title?.trim();
      if (title) {
          return { detail: title, taskType: '' };
      }
      const detail = data.imageDialogueText?.trim() ||
          data.videoDialogueText?.trim() ||
          data.genPrompt?.trim() ||
          '';
      if (!detail)
          return null;
      let taskType = '生成';
      if (data.generationTaskType === 'VIDEO') {
          taskType = resolveVideoTaskTypeLabel(data.videoGenTab);
      }
      else if (data.generationTaskType === 'IMAGE') {
          const hasRefs = Boolean(data.imageSourceRefs?.length || data.sourcePreviewUrl);
          taskType = hasRefs ? '图生图' : '文生图';
      }
      else if (data.generationTaskType === 'TEXT') {
          taskType = '文本生成';
      }
      else if (data.generationTaskType === 'MODEL') {
          taskType = '图生3D';
      }
      return { detail, taskType };
  };
  
  ctx.persistGenerationTaskBinding = function persistGenerationTaskBinding(node?: Node, options?: {
      detail?: string;
      taskType?: string;
  }) {
      if (options?.detail !== undefined || options?.taskType !== undefined) {
          ctx.recordCanvasDescription(options?.detail ?? '', options?.taskType ?? '');
      }
      else if (node) {
          const inferred = ctx.inferGenerationTaskDescriptionFromNode(node);
          if (inferred) {
              ctx.recordCanvasDescription(inferred.detail, inferred.taskType);
          }
      }
      ctx.scheduleHistoryPush();
      ctx.triggerAutoSaveIfReady();
  };
  
  ctx.handleExportCanvas = function handleExportCanvas() {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.persistImageDialogueFields();
      ctx.persistVideoDialogueFields();
      const snapshot = getCanvasSnapshot(g, {
          projectId: ctx.activeProjectId.value,
          projectName: ctx.currentProjectName.value,
          canvasBgTheme: ctx.canvasBgTheme.value,
          gridVisible: ctx.gridVisible.value,
          panMode: ctx.panMode.value,
          showMinimap: ctx.showMinimap.value,
      });
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${ctx.activeProjectId.value || 'canvas'}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
  };
  
  ctx.clearCanvasTextSelection = function clearCanvasTextSelection() {
      window.getSelection()?.removeAllRanges();
  };
  
  ctx.openAddMenuAtGraphPoint = function openAddMenuAtGraphPoint(graphPoint: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !overlayRoot)
          return;
      ctx.clearCanvasTextSelection();
      ctx.closeConnectMenu();
      ctx.addMenuDropPoint.value = graphPoint;
      const offset = graphLocalToContainerOffset(g, graphPoint.x, graphPoint.y, overlayRoot);
      const rect = overlayRoot.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = 420;
      ctx.addMenuPos.value = {
          left: Math.max(12, Math.min(offset.left, rect.width - menuWidth - 12)),
          top: Math.max(60, Math.min(offset.top, rect.height - menuHeight - 12)),
      };
      ctx.showAddMenu.value = true;
  };
  
  ctx.updateAddMenuPosition = function updateAddMenuPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const drop = ctx.addMenuDropPoint.value;
      if (!g || !overlayRoot || !ctx.showAddMenu.value || !drop)
          return;
      const offset = graphLocalToContainerOffset(g, drop.x, drop.y, overlayRoot);
      const rect = overlayRoot.getBoundingClientRect();
      const menuWidth = 220;
      const menuHeight = 420;
      ctx.addMenuPos.value = {
          left: Math.max(12, Math.min(offset.left, rect.width - menuWidth - 12)),
          top: Math.max(60, Math.min(offset.top, rect.height - menuHeight - 12)),
      };
  };
  
  ctx.updateConnectMenuPosition = function updateConnectMenuPosition() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const release = ctx.connectReleasePoint.value;
      if (!g || !overlayRoot || !ctx.showConnectMenu.value || !release)
          return;
      const source = g.getCellById(ctx.connectSourceNodeId.value);
      if (!source?.isNode())
          return;
      const { left, top } = getConnectMenuPosition(g, source as Node, overlayRoot, release);
      ctx.connectMenuPos.value = { left, top };
      ctx.syncConnectPreviewEdgeTarget();
  };
  
  ctx.openConnectMenu = function openConnectMenu(source: Node, releasePoint: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !overlayRoot)
          return;
      ctx.closeAddMenu();
      ctx.closeNodeDialoguePanels();
      ctx.setTextEditorToolbarActive(false);
      if (ctx.connectSourceNodeId.value && ctx.connectSourceNodeId.value !== source.id) {
          ctx.setConnectSourceNodeMetaHidden(false);
      }
      ctx.connectSourceNodeId.value = source.id;
      ctx.connectReleasePoint.value = releasePoint;
      const { left, top } = getConnectMenuPosition(g, source, overlayRoot, releasePoint);
      ctx.connectMenuPos.value = { left, top };
      ctx.showConnectMenu.value = true;
      ctx.setConnectSourceNodeMetaHidden(true);
      (g as CanvasGraph).__suppressBlankCloseForConnect = true;
      window.setTimeout(() => {
          ;
          (g as CanvasGraph).__suppressBlankCloseForConnect = false;
      }, 0);
      nextTick(() => ctx.syncConnectPreviewEdgeTarget());
  };
  
  ctx.finishConnectSpawn = function finishConnectSpawn(node: Node) {
      ctx.selectedNodeId.value = node.id;
      ctx.syncNodeSelectionHighlight(node.id);
      ctx.updateNodeToolbar();
      ctx.syncNodeCount();
      ctx.closeConnectMenu();
  };
  
  ctx.onConnectMenuItem = function onConnectMenuItem(item: (typeof CONNECT_GENERATE_MENU)[number]) {
      if (item.disabled)
          return;
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      const sourceId = ctx.connectSourceNodeId.value;
      if (!g || !overlayRoot || !sourceId)
          return;
      const source = g.getCellById(sourceId);
      if (!source?.isNode())
          return;
      const point = resolveConnectSpawnPoint(g, overlayRoot, source as Node, ctx.connectMenuPos.value, item.key as ConnectMenuKey);
      if (!point)
          return;
      const spawned = createNodeFromConnectMenu(g, source as Node, point, item.key as ConnectMenuKey);
      if (!spawned)
          return;
      const data = spawned.getData() as CanvasNodeData;
      if (data.mode === 'picker' && (data.kind === 'text' || data.kind === 'audio')) {
          ctx.activePickerNodeId.value = spawned.id;
          if (data.kind === 'text') {
              ctx.loadPromptBarContext(spawned.id);
          }
      }
      ctx.finishConnectSpawn(spawned);
      // 文生图 / 图生图目标节点：在其下方打开图片生成提示栏
      if (data.kind === 'image') {
          const sourceData = source.getData() as CanvasNodeData;
          if (shouldOpenImageGenPromptBar(g, spawned.id, data) ||
              sourceData.kind === 'text') {
              ctx.openImageGenPromptBar(spawned.id);
          }
          else {
              ctx.openImageDialogue(spawned.id);
          }
      }
      else if (data.kind === 'video' && data.mode === 'picker') {
          const sourceData = source.getData() as CanvasNodeData;
          const tab = sourceData.kind === 'text'
              ? 'text2video'
              : sourceData.kind === 'image'
                  ? 'reference'
                  : 'text2video';
          ctx.openVideoGenPromptBar(spawned.id, tab);
      }
  };
  
  ctx.openConnectMenuByNodeId = function openConnectMenuByNodeId(nodeId: string, releasePoint: {
      x: number;
      y: number;
  }) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      ctx.openConnectMenu(cell as Node, releasePoint);
  };
  
  provide('openConnectMenuByNodeId', ctx.openConnectMenuByNodeId);
  
  ctx.getEdgeReleasePoint = function getEdgeReleasePoint(edge: Edge) {
      const target = edge.getTarget();
      if (target && typeof target === 'object' && 'x' in target && 'y' in target) {
          return { x: Number(target.x), y: Number(target.y) };
      }
      return null;
  };
  
  ctx.handleEdgeConnected = function handleEdgeConnected({ edge, isNew, currentCell, currentPoint, }: {
      edge: Edge;
      isNew?: boolean;
      currentCell?: {
          isNode?: () => boolean;
      } | null;
      currentPoint?: {
          x: number;
          y: number;
      } | null;
  }) {
      if (!isNew)
          return;
      const g = ctx.graph.value;
      if (!g)
          return;
      if (currentCell?.isNode?.()) {
          const target = currentCell as Node;
          const targetData = target.getData() as CanvasNodeData;
          if (targetData.kind === 'text' || targetData.kind === 'video') {
              ctx.handleNodeEdgeLinked(target.id, edge.getSourceCellId() ?? undefined);
          }
          else if (targetData.kind === 'image' && canImageNodeAcceptIncoming(targetData)) {
              ctx.linkImageSourceFromEdge(g, edge, target);
          }
          else {
              g.removeEdge(edge.id);
              return;
          }
          edge.setAttrs(getFlowEdgeAttrs());
          applyFlowEdgeStyle(g, edge);
          return;
      }
      const source = edge.getSourceCell();
      if (!source?.isNode() || !canOpenConnectMenu(source as Node)) {
          g.removeEdge(edge.id);
          return;
      }
      const canvasGraph = g as CanvasGraph;
      if (canvasGraph.__connectPreviewEdgeId === edge.id && ctx.showConnectMenu.value)
          return;
      const releasePoint = currentPoint ?? ctx.getEdgeReleasePoint(edge);
      if (!releasePoint)
          return;
      canvasGraph.__connectPreviewEdgeId = edge.id;
      edge.setAttrs(getPreviewEdgeAttrs());
      applyFlowEdgeStyle(g, edge);
      ctx.openConnectMenu(source as Node, releasePoint);
  };
}
