// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Persistence 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { ProjectCanvasResponse,ProjectVersionDetailResponse } from '@/services/api';
import { isRequestError } from '@/utils/request';
import type { Edge,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick,provide } from 'vue';
import { formatCanvasDescription,formatUploadCanvasDescription,resolveCanvasSaveDescription,resolveCanvasSaveType,resolveVideoTaskTypeLabel,} from '../../../canvasDescription';
import { buildProjectCanvasPayloadFromVersionDetail } from '../../../canvasHistoryRecords';
import { resetResumedGenerationTaskCache } from '../../../generationTask';
import type { CanvasGraph,CanvasNodeData,CanvasSnapshot,ConnectMenuKey } from '.././sharedImports';
import { api,applyCanvasBgTheme,applyCanvasSnapshot,applyFlowEdgeStyle,canImageNodeAcceptIncoming,canOpenConnectMenu,CONNECT_GENERATE_MENU,createNodeFromConnectMenu,ensureInfiniteCanvasArea,getCanvasSnapshot,getConnectMenuPosition,getFlowEdgeAttrs,getPreviewEdgeAttrs,getScroller,graphLocalToContainerOffset,hydrateMissingImageNodeDimensions,normalizeCanvasSnapshot,refreshCanvasNodeViews,resolveConnectSpawnPoint,saveCanvasSnapshotToStorage,shouldOpenImageGenPromptBar,syncAllNodeSizes,syncPendingImageTargetFromSources } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

function normalizeProjectId(id: unknown): string {
  if (id == null) return '';
  return String(id).trim();
}

function normalizeSaveType(saveType: unknown): 'MANUAL' | 'AUTO' {
  return saveType === 'AUTO' ? 'AUTO' : 'MANUAL';
}

function readRouteProjectId(ctx: CoreRuntimeContext): string {
  const routeId = ctx.router?.currentRoute?.value?.params?.id;
  return normalizeProjectId(Array.isArray(routeId) ? routeId[0] : routeId);
}

type PendingSaveJob = {
  projectId: string
  snapshot: CanvasSnapshot
  type: 'MANUAL' | 'AUTO'
  resolve: (ok: boolean) => void
};

export function installPersistenceState(ctx: CoreRuntimeContext) {
  ctx.autoSaveDebounceTimer = null;
  ctx.autoSaveEnabled = true;
  ctx.canvasContentReady = false;
  /** 当前 graph 已成功应用的项目；切路由但未应用新画布前为空，禁止跨项目保存 */
  ctx.canvasBoundProjectId = '';
  ctx.saveInFlight = false;
  ctx.pendingRemoteSaveType = null;
  ctx.pendingSaveJobs = [];
  ctx.pendingProjectCanvas = null;
  ctx.localDirty = false;
  ctx.localChangeEpoch = 0;
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
      const projectId = normalizeProjectId(payload.projectId);
      const routeId = readRouteProjectId(ctx);
      // 路由项目页：拒绝把其他项目的响应写进当前画布 / 活动 ID
      if (routeId && projectId && projectId !== routeId)
          return false;
      resetResumedGenerationTaskCache();
      const canvasData = payload.canvasData ?? payload.canvas ?? { graph: { cells: [] } };
      const boundProjectId = projectId || routeId;
      ctx.activeProjectId.value = boundProjectId;
      ctx.canvasBoundProjectId = boundProjectId;
      // 目标画布已成功绑定：恢复自动保存（beginProjectCanvasSwitch 会先关掉）
      ctx.autoSaveEnabled = true;
      ctx.localDirty = false;
      ctx.canvasRevision.value = payload.revision;
      ctx.lastCanvasDescription.value = payload.description?.trim() || '';
      const snapshot = normalizeCanvasSnapshot(canvasData as Partial<CanvasSnapshot>, {
          projectId: boundProjectId,
          projectName: (canvasData as { meta?: { projectName?: string } }).meta?.projectName ?? '未命名创作',
      });
      ctx.upsertCanvasProject(boundProjectId, snapshot.meta.projectName, true);
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
  
  ctx.markLocalCanvasChange = function markLocalCanvasChange() {
      ctx.localChangeEpoch = (ctx.localChangeEpoch || 0) + 1;
      ctx.localDirty = true;
      const projectId = ctx.resolveActiveProjectId();
      if (!projectId)
          return;
      const project = ctx.findCanvasProject(projectId);
      if (project) {
          project.saved = false;
      }
  };

  ctx.pauseAutoSave = function pauseAutoSave() {
      // 仅暂停发送，不清 canvasContentReady，避免 pagehide 后操作/生成结果永久无法落库
      ctx.autoSaveEnabled = false;
      if (ctx.autoSaveDebounceTimer) {
          clearTimeout(ctx.autoSaveDebounceTimer);
          ctx.autoSaveDebounceTimer = null;
      }
      // pagehide 只能丢弃可重建的自动保存；已确认的手动保存请求必须保留
      const jobs = Array.isArray(ctx.pendingSaveJobs) ? ctx.pendingSaveJobs : [];
      const kept: PendingSaveJob[] = [];
      for (const job of jobs) {
          if (job.type === 'MANUAL') {
              kept.push(job);
          }
          else {
              job.resolve(false);
          }
      }
      ctx.pendingSaveJobs = kept;
      if (kept.some((job) => job.type === 'MANUAL')) {
          ctx.pendingRemoteSaveType = 'MANUAL';
      }
      else {
          ctx.pendingRemoteSaveType = null;
      }
  };

  ctx.stopAutoSave = function stopAutoSave() {
      ctx.pauseAutoSave();
      ctx.canvasContentReady = false;
  };

  /**
   * 路由切项目开始：冻结旧画布、停自动保存、清空 graph，
   * 避免「B 路由 + A 画布」窗口内编辑/保存落到新项目。
   */
  ctx.beginProjectCanvasSwitch = function beginProjectCanvasSwitch() {
      ctx.stopAutoSave();
      ctx.canvasBoundProjectId = '';
      ctx.localDirty = false;
      const jobs = Array.isArray(ctx.pendingSaveJobs) ? ctx.pendingSaveJobs : [];
      for (const job of jobs) {
          job.resolve(false);
      }
      ctx.pendingSaveJobs = [];
      ctx.pendingRemoteSaveType = null;
      ctx.pendingProjectCanvas = null;
      if (typeof ctx.resetCanvasInteractionState === 'function') {
          ctx.resetCanvasInteractionState();
      }
      const g = ctx.graph.value;
      if (g && typeof g.clearCells === 'function') {
          g.clearCells();
      }
      ctx.syncNodeCount?.();
      ctx.bumpToolbarRevision?.();
      ctx.updateNodeToolbar?.();
  };

  ctx.getCanvasBoundProjectId = function getCanvasBoundProjectId(): string {
      return normalizeProjectId(ctx.canvasBoundProjectId);
  };

  /** 图已挂载且已绑定到当前路由项目时，自愈就绪标记（覆盖加载竞态 / pagehide 后未恢复） */
  ctx.ensureCanvasReadyForAutoSave = function ensureCanvasReadyForAutoSave(): boolean {
      if (!ctx.autoSaveEnabled)
          return false;
      const routeId = readRouteProjectId(ctx);
      const bound = normalizeProjectId(ctx.canvasBoundProjectId);
      // 路由已切走但画布尚未绑定到新项目：禁止自愈就绪，杜绝跨项目自动保存
      if (routeId && (!bound || bound !== routeId))
          return false;
      if (ctx.canvasContentReady)
          return true;
      if (!ctx.graph.value)
          return false;
      const projectId = typeof ctx.resolveActiveProjectId === 'function'
          ? ctx.resolveActiveProjectId()
          : String(ctx.activeProjectId.value ?? '').trim();
      if (!projectId)
          return false;
      ctx.markCanvasContentReady();
      return true;
  };
  
  ctx.triggerAutoSaveIfReady = function triggerAutoSaveIfReady() {
      if (!ctx.ensureCanvasReadyForAutoSave())
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
      ctx.pauseAutoSave();
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
      const project = ctx.findCanvasProject(projectId);
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
          projectId: ctx.resolveActiveProjectId() || ctx.activeProjectId.value,
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
          ctx.localDirty = false;
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
          ctx.localDirty = false;
      }
  };
  
  ctx.resolveActiveProjectId = function resolveActiveProjectId(): string {
      // 路由项目页：只有画布已绑定到当前路由项目时，才允许以该 ID 作为保存目标
      const fromRoute = readRouteProjectId(ctx);
      const bound = normalizeProjectId(ctx.canvasBoundProjectId);
      if (fromRoute) {
          if (bound && bound === fromRoute) {
              if (normalizeProjectId(ctx.activeProjectId.value) !== fromRoute) {
                  ctx.activeProjectId.value = fromRoute;
              }
              return fromRoute;
          }
          // 路由已切换、旧画布未卸绑完成：返回空以阻断保存
          return '';
      }
      const current = normalizeProjectId(ctx.activeProjectId.value);
      if (current) {
          ctx.activeProjectId.value = current;
          return current;
      }
      return '';
  };

  ctx.findCanvasProject = function findCanvasProject(projectId: string) {
      const normalized = normalizeProjectId(projectId);
      return ctx.canvasProjects.value.find((item) => normalizeProjectId(item.id) === normalized);
  };

  ctx.syncPendingRemoteSaveTypeFlag = function syncPendingRemoteSaveTypeFlag() {
      const jobs: PendingSaveJob[] = Array.isArray(ctx.pendingSaveJobs) ? ctx.pendingSaveJobs : [];
      if (jobs.some((job) => job.type === 'MANUAL')) {
          ctx.pendingRemoteSaveType = 'MANUAL';
      }
      else if (jobs.length > 0) {
          ctx.pendingRemoteSaveType = 'AUTO';
      }
      else {
          ctx.pendingRemoteSaveType = null;
      }
  };

  ctx.enqueuePendingSaveJob = function enqueuePendingSaveJob(job: Omit<PendingSaveJob, 'resolve'>): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
          if (!Array.isArray(ctx.pendingSaveJobs)) {
              ctx.pendingSaveJobs = [];
          }
          ctx.pendingSaveJobs.push({ ...job, resolve });
          ctx.syncPendingRemoteSaveTypeFlag();
      });
  };

  ctx.drainPendingSaveJobs = async function drainPendingSaveJobs() {
      while (Array.isArray(ctx.pendingSaveJobs) && ctx.pendingSaveJobs.length > 0) {
          const jobs: PendingSaveJob[] = ctx.pendingSaveJobs.splice(0);
          ctx.syncPendingRemoteSaveTypeFlag();
          const type: 'MANUAL' | 'AUTO' = jobs.some((job) => job.type === 'MANUAL') ? 'MANUAL' : 'AUTO';
          if (type === 'AUTO' && !ctx.autoSaveEnabled) {
              jobs.forEach((job) => job.resolve(false));
              continue;
          }
          // 取队列末次快照；仅当画布已绑定到当前路由项目时才允许落库
          const routeId = readRouteProjectId(ctx);
          const bound = normalizeProjectId(ctx.canvasBoundProjectId);
          const projectId = (routeId && bound === routeId) ? routeId : '';
          if (!projectId) {
              jobs.forEach((job) => job.resolve(false));
              continue;
          }
          const matchingJobs = jobs.filter((job) => job.projectId === projectId);
          const dropped = jobs.filter((job) => job.projectId !== projectId);
          dropped.forEach((job) => job.resolve(false));
          if (!matchingJobs.length) {
              continue;
          }
          const snapshot = matchingJobs[matchingJobs.length - 1].snapshot;
          const ok = await ctx.runRemoteCanvasSaveJob({
              projectId,
              snapshot,
              type,
          });
          matchingJobs.forEach((job) => job.resolve(ok));
      }
  };

  ctx.runRemoteCanvasSaveJob = async function runRemoteCanvasSaveJob(job: {
      projectId: string
      snapshot: CanvasSnapshot
      type: 'MANUAL' | 'AUTO'
  }): Promise<boolean> {
      const projectId = normalizeProjectId(job.projectId);
      if (!projectId)
          return false;
      const routeId = readRouteProjectId(ctx);
      const bound = normalizeProjectId(ctx.canvasBoundProjectId);
      // 快照必须属于当前已绑定画布，且与路由一致，防止 A 内容写入 B
      if (!bound || projectId !== bound)
          return false;
      if (routeId && projectId !== routeId)
          return false;
      const project = ctx.findCanvasProject(projectId);
      ctx.saveInFlight = true;
      let ok = false;
      try {
          await ctx.persistCanvasToServer(projectId, job.snapshot, job.type, project);
          ok = true;
      }
      catch (error) {
          console.error('[Canvas] save to server failed', error);
          if (project)
              project.saved = false;
          ok = false;
      }
      finally {
          ctx.saveInFlight = false;
      }
      return ok;
  };

  ctx.flushRemoteCanvasSave = async function flushRemoteCanvasSave(saveType: 'MANUAL' | 'AUTO', reusedSnapshot?: CanvasSnapshot | null): Promise<boolean> {
      const type = normalizeSaveType(saveType);
      const routeId = readRouteProjectId(ctx);
      const bound = normalizeProjectId(ctx.canvasBoundProjectId);
      // 手动保存不受 pauseAutoSave（pagehide/beforeunload）影响；顺带恢复自动保存
      if (type === 'MANUAL') {
          ctx.autoSaveEnabled = true;
          // 切项目窗口内禁止“强制就绪”，避免旧画布被标成可保存
          if (!ctx.canvasContentReady && ctx.graph.value && bound && (!routeId || bound === routeId)) {
              ctx.markCanvasContentReady();
          }
      }
      else if (!ctx.ensureCanvasReadyForAutoSave()) {
          return false;
      }
      if (routeId && (!bound || bound !== routeId))
          return false;
      const projectId = ctx.resolveActiveProjectId();
      if (!projectId)
          return false;
      const snapshot = reusedSnapshot ?? ctx.buildCanvasSnapshot();
      if (!snapshot)
          return false;

      if (ctx.saveInFlight) {
          return ctx.enqueuePendingSaveJob({ projectId, snapshot, type });
      }

      const ok = await ctx.runRemoteCanvasSaveJob({ projectId, snapshot, type });
      await ctx.drainPendingSaveJobs();
      return ok;
  };
  
  ctx.handleSaveCanvas = function handleSaveCanvas(saveType: 'MANUAL' | 'AUTO' = 'MANUAL') {
      const type = normalizeSaveType(saveType);
      if (type === 'AUTO') {
          if (!ctx.ensureCanvasReadyForAutoSave())
              return;
      }
      else {
          const routeId = readRouteProjectId(ctx);
          const bound = normalizeProjectId(ctx.canvasBoundProjectId);
          if (routeId && (!bound || bound !== routeId)) {
              message.warning('项目切换中，请稍后再保存');
              return;
          }
          // 顶部工具栏 / 快捷键：始终允许手动保存（已绑定当前项目时）
          ctx.autoSaveEnabled = true;
          if (!ctx.canvasContentReady && ctx.graph.value) {
              ctx.markCanvasContentReady();
          }
      }
      const snapshot = ctx.buildCanvasSnapshot();
      if (!snapshot) {
          if (type === 'MANUAL') {
              message.warning('画布尚未就绪，请稍后再试');
          }
          return;
      }
      saveCanvasSnapshotToStorage(snapshot);
      const projectId = ctx.resolveActiveProjectId();
      const project = ctx.findCanvasProject(projectId);
      if (project) {
          project.saved = false;
      }
      ctx.localDirty = true;
      if (!projectId) {
          if (type === 'MANUAL') {
              message.warning('无法保存：未找到当前项目');
              console.warn('[Canvas] skip remote save: missing projectId');
          }
          return;
      }
      const savePromise = ctx.flushRemoteCanvasSave(type, snapshot);
      if (type === 'MANUAL') {
          void savePromise.then((ok) => {
              if (ok)
                  message.success('保存成功');
              else
                  message.error('保存失败，请稍后重试');
          });
      }
  };
  
  ctx.hasUnsavedChanges = function hasUnsavedChanges() {
      const projectId = ctx.resolveActiveProjectId();
      if (!projectId)
          return false;
      if (ctx.localDirty)
          return true;
      if (ctx.saveInFlight || ctx.pendingRemoteSaveType)
          return true;
      const pendingJobs = Array.isArray(ctx.pendingSaveJobs) ? ctx.pendingSaveJobs : [];
      if (pendingJobs.length > 0)
          return true;
      const project = ctx.findCanvasProject(projectId);
      return project?.saved === false;
  };
  
  ctx.waitForSaveSettled = function waitForSaveSettled(maxWaitMs = 30000): Promise<void> {
      return new Promise((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
              const pendingJobs = Array.isArray(ctx.pendingSaveJobs) ? ctx.pendingSaveJobs : [];
              if (!ctx.saveInFlight && !ctx.pendingRemoteSaveType && pendingJobs.length === 0) {
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
      const type = normalizeSaveType(saveType);
      // MANUAL（保存并离开）：必须构建当前快照并等待该次结果，不得凭旧 saved 提前成功
      if (type === 'MANUAL') {
          try {
              ctx.autoSaveEnabled = true;
              if (!ctx.canvasContentReady && ctx.graph.value) {
                  ctx.markCanvasContentReady();
              }
              const snapshot = ctx.buildCanvasSnapshot();
              if (!snapshot)
                  return false;
              saveCanvasSnapshotToStorage(snapshot);
              const projectId = ctx.resolveActiveProjectId();
              if (!projectId)
                  return false;
              const project = ctx.findCanvasProject(projectId);
              if (project)
                  project.saved = false;
              ctx.localDirty = true;
              return await ctx.flushRemoteCanvasSave('MANUAL', snapshot);
          }
          catch (error) {
              console.error('[Canvas] saveCanvasAndWait failed', error);
              return false;
          }
      }
      if (!ctx.hasUnsavedChanges())
          return true;
      try {
          ctx.handleSaveCanvas(type);
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

      syncPendingImageTargetFromSources(g, spawned);

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
