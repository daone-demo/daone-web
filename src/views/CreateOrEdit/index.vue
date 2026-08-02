<template>
  <div class="create-or-edit">
    <div v-if="pageLoading" class="create-or-edit__loading" role="status" aria-live="polite">
      <span class="create-or-edit__loading-spinner" aria-hidden="true" />
      <p class="create-or-edit__loading-text">项目加载中...</p>
    </div>

    <template v-else>
      <Canvas
        ref="canvasRef"
        :projects-list="projectsList"
        :projects-loading="projectsLoading"
        :projects-has-more="projectsHasMore"
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
import { computed, createVNode, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Node } from '@antv/x6'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleFilled } from '@ant-design/icons-vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import Canvas from '@/components/Canvas/index.vue'
import ChatSidePanel from './ChatSidePanel.vue'
import type { ChatSendPayload } from './chatTypes'
import api, { type ProjectCanvasResponse } from '@/services/api'
import { useModalStore } from '@stores/useModal'
import { useUserInfo } from '@stores/useUserInfo';
import {
  groupWorkflowsByCategory,
  normalizeImageCapabilities,
  type ImageCapability,
  type WorkflowCategoryGroup,
  type WorkflowRecord,
} from '@/components/Canvas/constants'

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
// const ImageIcon = ref({
//   IMAGE_REMOVE_BG: '', // 抠图
//   quick: '', // 快速
//   precise: '', // 精准
//   IMAGE_HD: '', // 高清
//   '2K': '', // 2K
//   '4K': '', // 4K
//   IMAGE_CROP: '', // 智能裁剪
//   IMAGE_INPAINT: '', // 局部修改
//   IMAGE_PREVIEW: '', // 预览
//   IMAGE_GRID9: '', // 九宫格
//   IMAGE_REVERSE: '', // 扩图
//   IMAGE_EDIT_TEXT: '', // 编辑文本
//   IMAGE_LAYER_SPLIT: '', // 图层分离
//   IMAGE_GRID_SPLIT: '', // 宫格拆分
//   IMAGE_TO_3D: '', // 图片转3D
//   IMAGE_PROMPT_REVERSE: '', //反推提示词
//   IMAGE_TOPAZ_ENHANCE: '', // 图葩增强
// })

type CanvasExpose = {
  addImagesFromFiles: (files: File[]) => Promise<Node[]>
  getNodeCount: () => number
  hasUnsavedChanges: () => boolean
  saveCanvas: (saveType?: 'MANUAL' | 'AUTO') => void
  loadProjectCanvas: (payload: ProjectCanvasResponse) => boolean
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
const chatPanelCollapsed = ref(true)
const currentProjectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.trim() ? id : undefined
})
const canvasRef = ref<InstanceType<typeof Canvas> & CanvasExpose | null>(null)
const chatPanelRef = ref<InstanceType<typeof ChatSidePanel> | null>(null)
const pageLoading = ref(true)
const pendingCanvasPayload = ref<ProjectCanvasResponse | null>(null);
const aiSkills = ref<any[]>([]);
/** 用户已确认离开时跳过二次弹窗 */
let leaveConfirmed = false

function focusChatPanel() {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.focusInput()
}

function onAddToChat(payload: { previewUrl: string; fileName: string; assetId?: string }) {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.addAttachmentFromCanvas(payload)
}

function onAddAssetToChat(payload: { id: string; role: string; name: string }) {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.insertAssetMention(payload)
}

async function onChatSend(payload: ChatSendPayload) {
  console.log('onChatSend', payload);
  const canvas = canvasRef.value
  if (!canvas) return

  const files = payload.attachments
    .filter((item) => item.file.type.startsWith('image/') && item.file.size > 0)
    .map((item) => item.file)

  if (!files.length) return
  chatPanelRef.value?.beginProcessing()
  try {
    await canvas.addImagesFromFiles(files)
  } finally {
    chatPanelRef.value?.endProcessing()
  }
}

function onNewChat() {
  chatPanelRef.value?.endProcessing()
}

/**
 * Load project canvas
 */
const onLoadProjectCanvas = async (id?: string) => {
  const targetId = (id ?? route.params.id) as string
  if (!targetId?.trim()) return

  const res = await api.getProjectCanvas(targetId)
  if (canvasRef.value) {
    await nextTick()
    canvasRef.value.loadProjectCanvas(res)
    pendingCanvasPayload.value = null
    return
  }
  pendingCanvasPayload.value = res
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
  const res = await api.createProject({ title: getNextUntitledProjectTitle() })
  await onRefreshProjects()
  const newProjectId = (res as CanvasProjectItem).id
  if (!newProjectId) return
  leaveConfirmed = true
  await router.push({
    name: route.name ?? 'projectDetail',
    params: { id: newProjectId },
  })
}

const onRenameProject = (projectId: string, name: string) => {
  project_Id.value = projectId;
  projectName.value = name;
  modalStore.openModal('updateProjectName');
}

const onDeleteProject = async () => {
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
  console.log('workflows', workflows.value);
}

const onLoadChatModels = async () => {
  /* const res = */ await api.getChatModels();
  // console.log('chatModels', res);
}

const onLoadHistorySessions = async () => {
  if (!currentProjectId.value) {
    sessionName.value = '新建对话'
    return
  }

  const res = await api.getChatSessions({ projectId: currentProjectId.value, page: 1, pageSize: 100 });
  historySessions.value = res.records as unknown as any[];

  if (historySessions.value.length) {
    const first = historySessions.value[0]
    sessionName.value = first?.title || '新建对话'
    // 仅在尚未选中会话时，默认切到第一条历史
    if (!currentSessionId.value) {
      currentSessionId.value = first.id;
      await onLoadChatSession(first.id);
    }
  } else {
    sessionName.value = '新建对话'
  }
}

const onLoadChatSession = async (sessionId: string) => {
  const res = await api.queryChatSession(sessionId);
  console.log('chatSession', res);
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
  console.log('aiSkills', res);
  aiSkills.value = res.items ?? [];
}

async function initializePage() {
  pageLoading.value = true
  pendingCanvasPayload.value = null

  try {
    const projectId = typeof route.params.id === 'string' ? route.params.id.trim() : ''
    await Promise.all([
      onLoadProjects(),
      projectId ? onLoadProjectCanvas(projectId) : Promise.resolve(),
    ])
  } catch (error) {
    console.error('[CreateOrEdit] page init failed', error)
  } finally {
    pageLoading.value = false
    await nextTick()
    if (pendingCanvasPayload.value && canvasRef.value) {
      canvasRef.value.loadProjectCanvas(pendingCanvasPayload.value)
      pendingCanvasPayload.value = null
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
  if (leaveConfirmed) return false
  // 离开创作页 / 切换项目前均提示保存
  return true
}

function confirmLeaveBeforeRouteChange(): Promise<boolean> {
  if (!needsLeaveConfirm()) return Promise.resolve(true)

  const hasUnsaved = canvasRef.value?.hasUnsavedChanges?.() ?? false
  const content = hasUnsaved
    ? '当前项目有未保存的更改，离开后可能会丢失。请先点击保存，确认后再离开。'
    : '离开页面前请确认已保存当前项目，未保存的更改可能会丢失。'

  return new Promise((resolve) => {
    Modal.confirm({
      title: '离开前请先保存',
      icon: createVNode(ExclamationCircleFilled),
      content,
      okText: '仍要离开',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        leaveConfirmed = true
        resolve(true)
      },
      onCancel: () => {
        resolve(false)
      },
    })
  })
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

function onBrowserBeforeUnload(event: BeforeUnloadEvent) {
  // 浏览器关闭/刷新：仅在确实有未保存更改时拦截
  if (pageLoading.value) return
  if (!(canvasRef.value?.hasUnsavedChanges?.() ?? false)) return
  event.preventDefault()
  event.returnValue = ''
}

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (pageLoading.value) return
    if (typeof newId === 'string' && newId.trim() && newId !== oldId) {
      void onLoadProjectCanvas(newId).catch((error) => {
        console.error('[CreateOrEdit] load project canvas failed', error)
      })
    }
  },
)

onMounted(() => {
  window.addEventListener('beforeunload', onBrowserBeforeUnload)
  void initializePage()
  void userInfoStore.queryPointAccount()
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onBrowserBeforeUnload)
})

</script>

<style scoped lang="scss">
@import './index.scss';
</style>
