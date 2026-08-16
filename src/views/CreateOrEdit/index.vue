<template>
  <div class="create-or-edit">
    <div v-if="pageLoading" class="create-or-edit__loading" role="status" aria-live="polite">
      <span class="create-or-edit__loading-spinner" aria-hidden="true" />
      <p class="create-or-edit__loading-text">项目加载中...</p>
    </div>

    <template v-else>
      <div
        v-if="projectSwitchLoading"
        class="create-or-edit__loading create-or-edit__loading--switch"
        role="status"
        aria-live="polite"
      >
        <span class="create-or-edit__loading-spinner" aria-hidden="true" />
        <p class="create-or-edit__loading-text">项目切换中...</p>
      </div>
      <Canvas
        ref="canvasRef"
        :projects-list="projectsList"
        :projects-loading="projectsLoading"
        :projects-has-more="projectsHasMore"
        :creating-project="creatingProject"
        :image-capabilities="ImageCapabilities"
        :video-capabilities="VideoCapabilities"
        :text-capabilities="TextCapabilities"
        :chat-tools="chatTools"
        :workflows="workflows"
        @focus-chat="focusChatPanel"
        @add-to-chat="onAddToChat"
        @add-asset-to-chat="onAddAssetToChat"
        @new-project="onNewProject"
        @rename-project="onRenameProject"
        @delete-project="onDeleteProject"
        @load-more-projects="onLoadProjects"
        @toolbar-preferences-saved="onToolbarPreferencesSaved"
      />
      <ChatSidePanel
        ref="chatPanelRef"
        v-model:collapsed="chatPanelCollapsed"
        :project-id="currentProjectId"
        :history-sessions="historySessions"
        :current-session-id="currentSessionId"
        :session-name="sessionName"
        :chat-tools="chatTools"
        :ai-skills="aiSkills"
        @load-history-sessions="onLoadHistorySessions"
        @set-current-session-id="onSetCurrentSessionId"
        @send="onChatSend"
        @insert-image-to-canvas="onInsertImageToCanvas"
        @task-created="onChatTaskCreated"
        @task-updated="onChatTaskUpdated"
        @new-chat="onNewChat"
        @set-session-name="onSetSessionName"
        @close-chat="onCloseChat"
      />
      <UpdateProjectName
        v-model:open="modalStore.updateProjectNameVisible"
        v-model:project-id="project_Id"
        v-model:project-name="projectName"
        @submit="onRefreshProjects"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, createVNode, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Node } from '@antv/x6'
import { Modal, message } from 'ant-design-vue'
import { ExclamationCircleFilled } from '@ant-design/icons-vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import ChatSidePanel from './ChatSidePanel.vue'
import type { ChatSendPayload, ChatTaskCreatedPayload } from './chatTypes'
import type { ChatTaskUpdatedPayload } from '@/components/Canvas/chatGenerationTask'
import api, { type ProjectCanvasResponse } from '@/services/api'
import { isLeaveConfirmSuppressed } from '@/utils/leaveGuard'
import { useModalStore } from '@stores/useModal'
import { useUserInfo } from '@stores/useUserInfo';
import {
  groupWorkflowsByCategory,
  normalizeImageCapabilities,
  registerCanvasCapabilities,
  type ImageCapability,
  type WorkflowCategoryGroup,
  type WorkflowRecord,
} from '@/components/Canvas/constants'
import {
  isCanvasResponseApplicable,
  normalizeRouteProjectId,
  shouldFlushPendingCanvasSlot,
  type PendingCanvasSlot,
} from './canvasLoadGuard'
import { flushPendingCanvasPayload } from './waitForCanvasRef'

/** 画布（含 X6）延迟加载，避免 CreateOrEdit 主包同步打入 vendor-x6 */
const Canvas = defineAsyncComponent(() => import('@/components/Canvas/index.vue'))

const userInfoStore = useUserInfo();
const ImageCapabilities = ref<ImageCapability[]>([])
const VideoCapabilities = ref<ImageCapability[]>([])
const TextCapabilities = ref<ImageCapability[]>([])
const modalStore = useModalStore();

const projectName = ref('');
const project_Id = ref('');
const historySessions = ref<any[]>([]);
const currentSessionId = ref('');
const sessionName = ref('');
const chatTools = ref<any>({});
const workflows = ref<WorkflowCategoryGroup[]>([]);
const page = ref(1);

type CanvasExpose = {
  addImageFromAsset: (asset: {
    assetId?: string
    previewUrl: string
    fileName?: string
    width?: number | null
    height?: number | null
  }) => Node | null
  addImagesFromFiles: (files: File[]) => Promise<Node[]>
  getNodeCount: () => number
  hasUnsavedChanges: () => boolean
  saveCanvas: (saveType?: 'MANUAL' | 'AUTO') => void
  saveCanvasAndWait: (saveType?: 'MANUAL' | 'AUTO') => Promise<boolean>
  setCanvasDescription: (description: string, taskType?: string) => void
  loadProjectCanvas: (payload: ProjectCanvasResponse) => boolean
  createNodeFromChatTask: (payload: ChatTaskCreatedPayload) => Node | null
  updateChatTaskNodeTitleFromPayload?: (payload: ChatTaskUpdatedPayload) => void
  beginProjectCanvasSwitch?: () => void
  getCanvasBoundProjectId?: () => string
}

type CanvasProjectItem = {
  id: string
  title: string
  coverAssetId: string | null
  coverUrl: string | null
  revision: number
  createdAt: string
  updatedAt: string
}

const route = useRoute();
const router = useRouter();
const projectsList = ref<CanvasProjectItem[]>([]);
const projectsLoading = ref(false)
const projectsHasMore = ref(true)
const creatingProject = ref(false)
const chatPanelCollapsed = ref(true)
const currentProjectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.trim() ? id : undefined
})
const canvasRef = ref<(Omit<InstanceType<typeof Canvas>, keyof CanvasExpose> & CanvasExpose) | null>(null)
const chatPanelRef = ref<InstanceType<typeof ChatSidePanel> | null>(null)
const pageLoading = ref(true)
/** 路由切项目期间遮罩：冻结编辑，直至新画布绑定成功 */
const projectSwitchLoading = ref(false)
/** 带 epoch/projectId 归属的 pending，避免无归属单槽被旧响应覆盖 */
const pendingCanvasPayload = ref<PendingCanvasSlot<ProjectCanvasResponse> | null>(null)
const aiSkills = ref<any[]>([]);
/** 画布加载代数：每次发起/作废请求递增，用于丢弃乱序旧响应 */
let canvasLoadEpoch = 0
/** 项目切换请求代数，避免失败回退与并发切换互相清掉 loading */
let projectSwitchEpoch = 0
/** 用户已确认离开时跳过二次弹窗 */
let leaveConfirmed = false
/** 避免同时弹出多个离开确认框 */
let pendingLeaveConfirm: Promise<boolean> | null = null

function currentRouteProjectId(): string {
  return normalizeRouteProjectId(route.params.id)
}

type BrowserNavigateEvent = Event & {
  navigationType: 'reload' | 'push' | 'replace' | 'traverse'
  destination: { url: string }
  canIntercept: boolean
  cancelable: boolean
  hashChange: boolean
  preventDefault: () => void
}

type BrowserNavigation = EventTarget & {
  addEventListener: (type: 'navigate', listener: (event: BrowserNavigateEvent) => void) => void
  removeEventListener: (type: 'navigate', listener: (event: BrowserNavigateEvent) => void) => void
  reload: () => void
}

function getBrowserNavigation(): BrowserNavigation | null {
  const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation
  return navigation ?? null
}

function focusChatPanel() {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.focusInput()
}

function onAddToChat(payload: {
  previewUrl: string
  fileName: string
  assetId?: string
  nodeId?: string
}) {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.addAttachmentFromCanvas(payload)
}

function onAddAssetToChat(payload: { id: string; role: string; name: string }) {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.insertAssetMention(payload)
}

/** 聊天侧栏上传成功：插入画布图片节点，并把 nodeId 回绑到附件 */
function onInsertImageToCanvas(payload: {
  attachmentId: string
  assetId?: string
  previewUrl: string
  fileName?: string
  width?: number | null
  height?: number | null
}) {
  const node = canvasRef.value?.addImageFromAsset?.({
    assetId: payload.assetId,
    previewUrl: payload.previewUrl,
    fileName: payload.fileName,
    width: payload.width,
    height: payload.height,
  })
  if (node?.id) {
    chatPanelRef.value?.bindAttachmentNodeId?.(payload.attachmentId, node.id)
  }
}

function onChatSend(payload: ChatSendPayload) {
  const text = payload.text.trim()
  if (text) {
    canvasRef.value?.setCanvasDescription?.(text, '对话')
  }
  // 图片已在上传成功时插入画布并绑定 nodeId，发送时不再重复插入
}

function onChatTaskCreated(payload: ChatTaskCreatedPayload) {
  const payloadProjectId = String(payload.projectId ?? '').trim()
  const currentId = currentProjectId.value
  if (payloadProjectId && currentId && payloadProjectId !== currentId) return
  canvasRef.value?.createNodeFromChatTask?.(payload)
}

function onChatTaskUpdated(payload: ChatTaskUpdatedPayload) {
  const payloadProjectId = String(payload.projectId ?? '').trim()
  const currentId = currentProjectId.value
  if (payloadProjectId && currentId && payloadProjectId !== currentId) return
  canvasRef.value?.updateChatTaskNodeTitleFromPayload?.(payload)
}

function onNewChat() {
  chatPanelRef.value?.endProcessing()
}

/**
 * 投递画布快照：已有 Canvas 则立即注入，否则写入带归属的 pending。
 * 注意：初始化阶段 pageLoading=true 时 Canvas 未挂载，绝不能在此阻塞等待，
 * 否则会与「loading 结束后才渲染 Canvas」形成死锁（最长约 wait 超时）。
 */
const queueOrApplyCanvasPayload = (
  payload: ProjectCanvasResponse,
  meta: { epoch: number; projectId: string },
) => {
  if (!shouldFlushPendingCanvasSlot(
    { epoch: meta.epoch, projectId: meta.projectId, payload },
    { currentEpoch: canvasLoadEpoch, routeId: currentRouteProjectId() },
  )) {
    return false
  }
  if (flushPendingCanvasPayload(canvasRef.value, payload)) {
    pendingCanvasPayload.value = null
    return true
  }
  pendingCanvasPayload.value = {
    epoch: meta.epoch,
    projectId: meta.projectId,
    payload,
  }
  return false
}

/** 冲刷当前仍归属有效的 pending（旧 epoch / 错项目直接丢弃） */
const tryFlushOwnedPendingCanvas = (): boolean => {
  const pending = pendingCanvasPayload.value
  if (!shouldFlushPendingCanvasSlot(pending, {
    currentEpoch: canvasLoadEpoch,
    routeId: currentRouteProjectId(),
  })) {
    if (pending) pendingCanvasPayload.value = null
    return false
  }
  if (flushPendingCanvasPayload(canvasRef.value, pending.payload)) {
    pendingCanvasPayload.value = null
    return true
  }
  return false
}

/** 页面已展示后，短等异步 Canvas（含内部 graph 就绪）再冲刷 pending */
const flushPendingCanvasWhenReady = async () => {
  if (!pendingCanvasPayload.value) return
  if (tryFlushOwnedPendingCanvas()) return
  // ref 可能先于 graph 就绪：在超时内重试 load，直到真正注入成功
  const started = Date.now()
  while (Date.now() - started < 8_000 && pendingCanvasPayload.value) {
    await nextTick()
    if (tryFlushOwnedPendingCanvas()) return
    // pending 已被判定过期清空
    if (!pendingCanvasPayload.value) return
    await new Promise<void>((resolve) => setTimeout(resolve, 16))
  }
}

const onLoadProjectCanvas = async (id?: string) => {
  const targetId = normalizeRouteProjectId(id ?? route.params.id)
  if (!targetId) return

  const requestEpoch = ++canvasLoadEpoch
  // 新请求作废旧 pending，避免 A 慢返回覆盖 B
  pendingCanvasPayload.value = null

  let res: ProjectCanvasResponse
  try {
    res = await api.getProjectCanvas(targetId)
  } catch (error) {
    // 失败也不让旧逻辑误用；仅当仍是最新请求时向上抛
    if (requestEpoch !== canvasLoadEpoch) return
    throw error
  }

  if (!isCanvasResponseApplicable({
    requestEpoch,
    currentEpoch: canvasLoadEpoch,
    targetId,
    routeId: currentRouteProjectId(),
    responseProjectId: res.projectId,
  })) {
    return
  }

  queueOrApplyCanvasPayload(res, { epoch: requestEpoch, projectId: targetId })
  // 切换项目时页面已展示，可短等 Canvas；初始化时由 initializePage finally 冲刷
  if (!pageLoading.value) {
    await flushPendingCanvasWhenReady()
  }
}

const onLoadProjects = async () => {
  if (projectsLoading.value || !projectsHasMore.value) return
  projectsLoading.value = true
  try {
    const res = await api.getProjects({ page: page.value, pageSize: 10 })
    const records = res.records as CanvasProjectItem[]
    if (page.value === 1) {
      projectsList.value = records
    } else {
      projectsList.value = [...projectsList.value, ...records]
    }
    page.value += 1
    projectsHasMore.value = projectsList.value.length < res.total
  } finally {
    projectsLoading.value = false
  }
}

function getNextUntitledProjectTitle() {
  const usedNumbers = new Set<number>()
  const pattern = /^未命名-(\d+)$/

  for (const project of projectsList.value) {
    const match = project.title?.match(pattern)
    if (match) {
      usedNumbers.add(Number(match[1]))
    }
  }

  let index = 0
  while (usedNumbers.has(index)) {
    index += 1
  }

  return `未命名-${index}`
}

const onNewProject = async () => {
  if (creatingProject.value) return
  creatingProject.value = true
  try {
    // 先复用统一离开保护：保存成功才允许切走；取消或保存失败则不创建、不跳转
    const canLeave = await confirmLeaveBeforeRouteChange()
    if (!canLeave) return

    const res = await api.createProject({ title: getNextUntitledProjectTitle() })
    await onRefreshProjects()
    const newProjectId = (res as CanvasProjectItem).id
    if (!newProjectId) {
      leaveConfirmed = false
      return
    }
    // leaveConfirmed 已在确认保存成功时置位，供路由守卫跳过二次弹窗
    await router.push({
      name: route.name ?? 'projectDetail',
      params: { id: newProjectId },
    })
  } catch (error) {
    leaveConfirmed = false
    console.error('[CreateOrEdit] create project failed', error)
    message.error('创建项目失败，请重试')
  } finally {
    creatingProject.value = false
  }
}

const onRenameProject = (projectId: string, name: string) => {
  project_Id.value = projectId;
  projectName.value = name;
  modalStore.openModal('updateProjectName');
}

/** 删除已由 Header/浏览器完成确认与接口调用，此处仅刷新列表 */
const onDeleteProject = async (_projectId: string) => {
  await onRefreshProjects()
}

const onCloseChat = () => {
  chatPanelCollapsed.value = true
}

/**
 * Refresh projects list
 */
const onRefreshProjects = async () => {
  page.value = 1
  projectsHasMore.value = true
  await onLoadProjects()
  canvasRef.value?.reloadProjectBrowser?.()
}

const onLoadWorkflows = async () => {
  const res = await api.getWorkflows({ page: 1, pageSize: 50 });
  workflows.value = groupWorkflowsByCategory(res.records as WorkflowRecord[]);
}

const onLoadChatModels = async () => {
  await api.getChatModels();
}

const onLoadHistorySessions = async (options?: { forceSelectFirst?: boolean }) => {
  if (!currentProjectId.value) {
    sessionName.value = '新建对话'
    historySessions.value = []
    currentSessionId.value = ''
    return
  }

  // const res = await api.getChatSessions({ projectId: currentProjectId.value, page: 1, pageSize: 100 });
  const res = await api.getChatSessions({ page: 1, pageSize: 100 });
  historySessions.value = res.records as unknown as any[];

  if (!historySessions.value.length) {
    sessionName.value = '新建对话'
    currentSessionId.value = ''
    return
  }

  // 仅在显式要求时选中历史首条；进入画布默认保持「新建对话」
  if (options?.forceSelectFirst) {
    const first = historySessions.value[0]
    sessionName.value = first?.title || '新建对话'
    currentSessionId.value = first.id
    return
  }

  if (currentSessionId.value) {
    const current = historySessions.value.find((item) => item.id === currentSessionId.value)
    if (current) {
      sessionName.value = current.title || sessionName.value || '新建对话'
      return
    }
  }

  sessionName.value = '新建对话'
  currentSessionId.value = ''
}

async function reloadChatForCurrentProject() {
  chatPanelRef.value?.resetForProject?.()
  currentSessionId.value = ''
  sessionName.value = '新建对话'
  historySessions.value = []
  await onLoadHistorySessions()
}

const onSetCurrentSessionId = (sessionId: string) => {
  currentSessionId.value = sessionId;
}

const onSetSessionName = (name: string) => {
  sessionName.value = name;
}

const onToolbarPreferencesSaved = async (payload: { nodeType: 'IMAGE' | 'VIDEO' | 'TEXT' }) => {
  await onLoadAiCapabilities(payload.nodeType)
}

const onLoadAiCapabilities = async (key: string) => {
  let params = {
    nodeType: key,
    scene: 'all'
  }
  const res: any = await api.queryAiCapabilities(params)
  const list = normalizeImageCapabilities(res)
  // 登记真实能力码，整组执行按节点标题回推能力时据此校正
  registerCanvasCapabilities(list)
  switch (key) {
    case 'TEXT':
      TextCapabilities.value = list
      break
    case 'IMAGE':
      ImageCapabilities.value = list
      break
    case 'VIDEO':
      VideoCapabilities.value = list
      break
    default:
      TextCapabilities.value = list
      break
  }
}

const onLoadChatTools = async () => {
  const res: any = await api.queryChatTools({})
  chatTools.value = res?.data ?? res ?? {}
}

const onLoadAiSkills = async () => {
  const res: any = await api.queryAiSkills()
  aiSkills.value = res ?? [];
}

async function initializePage() {
  pageLoading.value = true
  pendingCanvasPayload.value = null
  const initProjectId = currentRouteProjectId()

  try {
    await Promise.all([
      onLoadProjects(),
      initProjectId ? onLoadProjectCanvas(initProjectId) : Promise.resolve(),
    ])
  } catch (error) {
    console.error('[CreateOrEdit] page init failed', error)
  } finally {
    // 先结束「项目加载中」，再等异步 Canvas chunk 注入快照，避免死锁拖慢首屏
    pageLoading.value = false
    await nextTick()
    await flushPendingCanvasWhenReady()
    // 初始化期间切路由由 watch 已加载画布，但当时跳过了聊天重载
    const routeIdAfterInit = currentRouteProjectId()
    if (routeIdAfterInit && routeIdAfterInit !== initProjectId) {
      await reloadChatForCurrentProject()
    }
  }

  void Promise.all([
    onLoadWorkflows(),
    onLoadChatModels(),
    onLoadChatTools(),
    onLoadAiCapabilities('TEXT'),
    onLoadAiCapabilities('IMAGE'),
    onLoadAiCapabilities('VIDEO'),
    onLoadHistorySessions(),
    onLoadAiSkills()
  ]).catch((error) => {
    console.error('[CreateOrEdit] background init failed', error)
  })
}

function needsLeaveConfirm() {
  if (pageLoading.value) return false
  if (projectSwitchLoading.value) return false
  if (leaveConfirmed) return false
  if (isLeaveConfirmSuppressed()) return false
  // 离开创作页 / 切换项目前均提示保存
  return true
}

function saveCanvasBeforeLeave(): Promise<boolean> {
  return canvasRef.value?.saveCanvasAndWait?.('MANUAL') ?? Promise.resolve(true)
}

function confirmLeaveBeforeRouteChange(): Promise<boolean> {
  if (!needsLeaveConfirm()) return Promise.resolve(true)
  if (pendingLeaveConfirm) return pendingLeaveConfirm

  const hasUnsaved = canvasRef.value?.hasUnsavedChanges?.() ?? false
  const content = hasUnsaved
    ? '当前项目有未保存的更改，离开后可能会丢失。请先点击保存，确认后再离开。'
    : '离开页面前请确认已保存当前项目，未保存的更改可能会丢失。'

  pendingLeaveConfirm = new Promise((resolve) => {
    Modal.confirm({
      title: '离开前请先保存',
      icon: createVNode(ExclamationCircleFilled),
      content,
      okText: '保存并离开',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        const saved = await saveCanvasBeforeLeave()
        if (!saved) {
          message.error('保存失败，请重试')
          return Promise.reject(new Error('save failed'))
        }
        leaveConfirmed = true
        resolve(true)
      },
      onCancel: () => {
        resolve(false)
      },
      afterClose: () => {
        pendingLeaveConfirm = null
      },
    })
  })

  return pendingLeaveConfirm
}

onBeforeRouteLeave(async () => {
  const ok = await confirmLeaveBeforeRouteChange()
  if (!ok) return false
  leaveConfirmed = false
  return true
})

onBeforeRouteUpdate(async () => {
  const ok = await confirmLeaveBeforeRouteChange()
  if (!ok) return false
  leaveConfirmed = false
  return true
})

function onBrowserNavigationNavigate(event: BrowserNavigateEvent) {
  if (!needsLeaveConfirm()) return
  if (!event.cancelable || event.navigationType !== 'reload') return

  event.preventDefault()

  void confirmLeaveBeforeRouteChange().then((ok) => {
    if (!ok) return
    getBrowserNavigation()?.reload()
  })
}

function onBrowserBeforeUnload(event: BeforeUnloadEvent) {
  // Navigation API 已拦截刷新；此处仅兜底关闭标签页/窗口（浏览器限制，只能使用原生确认框）
  if (!needsLeaveConfirm()) return
  event.preventDefault()
  event.returnValue = ''
}

function isRefreshShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  return key === 'f5' || ((event.ctrlKey || event.metaKey) && key === 'r')
}

function onRefreshKeydown(event: KeyboardEvent) {
  if (!isRefreshShortcut(event) || !needsLeaveConfirm()) return

  event.preventDefault()
  event.stopPropagation()

  void confirmLeaveBeforeRouteChange().then((ok) => {
    if (ok) window.location.reload()
  })
}

watch(
  () => route.params.id,
  async (newId, oldId) => {
    const nextId = normalizeRouteProjectId(newId)
    const prevId = normalizeRouteProjectId(oldId)
    if (!nextId || nextId === prevId) return

    // 初始化期间也接受切路由：用 epoch 作废旧请求，避免 pageLoading 直接忽略导致串项目
    const switching = !pageLoading.value
    const switchEpoch = ++projectSwitchEpoch
    if (switching) {
      projectSwitchLoading.value = true
      canvasRef.value?.beginProjectCanvasSwitch?.()
    }

    try {
      await onLoadProjectCanvas(nextId)
      if (switchEpoch !== projectSwitchEpoch) return

      if (switching) {
        await flushPendingCanvasWhenReady()
        const boundId = canvasRef.value?.getCanvasBoundProjectId?.() ?? ''
        if (boundId !== nextId) {
          throw new Error('project canvas not applied to route target')
        }
      }

      if (!pageLoading.value) {
        await reloadChatForCurrentProject()
      }
    } catch (error) {
      if (switchEpoch !== projectSwitchEpoch) return
      console.error('[CreateOrEdit] load project failed', error)
      if (switching && prevId && currentRouteProjectId() === nextId) {
        message.error('项目加载失败，已返回原项目')
        leaveConfirmed = true
        try {
          await router.replace({
            name: route.name ?? 'projectDetail',
            params: { ...route.params, id: prevId },
          })
          // 回退导航会再次进入本 watch，由新一轮负责收尾 loading
          return
        } catch (navError) {
          console.error('[CreateOrEdit] revert project route failed', navError)
        }
      } else {
        message.error('项目加载失败')
      }
    } finally {
      // 已回退到旧路由时，由新一轮 switchEpoch 收尾，避免过早揭开遮罩
      if (
        switching &&
        switchEpoch === projectSwitchEpoch &&
        currentRouteProjectId() === nextId
      ) {
        projectSwitchLoading.value = false
      }
    }
  },
)

// Canvas 异步 chunk 就绪后，补投递仍归属当前路由的 pending
watch(canvasRef, (canvas) => {
  if (!canvas || !pendingCanvasPayload.value) return
  tryFlushOwnedPendingCanvas()
})

onMounted(() => {
  const navigation = getBrowserNavigation()
  if (navigation) {
    navigation.addEventListener('navigate', onBrowserNavigationNavigate)
  } else {
    window.addEventListener('keydown', onRefreshKeydown, { capture: true })
  }
  window.addEventListener('beforeunload', onBrowserBeforeUnload)
  void initializePage()
  void userInfoStore.queryPointAccount()
})

onUnmounted(() => {
  const navigation = getBrowserNavigation()
  if (navigation) {
    navigation.removeEventListener('navigate', onBrowserNavigationNavigate)
  } else {
    window.removeEventListener('keydown', onRefreshKeydown, { capture: true })
  }
  window.removeEventListener('beforeunload', onBrowserBeforeUnload)
})

</script>

<style scoped lang="scss">
@use './index.scss' as *;
</style>
