<template>
  <div class="create-or-edit">
    <Canvas
      ref="canvasRef"
      @focus-chat="focusChatPanel"
      @add-to-chat="onAddToChat"
      @add-asset-to-chat="onAddAssetToChat"
      :projects-list="projectsList"
      @new-project="onNewProject"
      @rename-project="onRenameProject"
      @delete-project="onDeleteProject"
      :image-capabilities="ImageCapabilities"
      :video-capabilities="VideoCapabilities"
      :text-capabilities="TextCapabilities"
    />
    <ChatSidePanel
      ref="chatPanelRef"
      v-model:collapsed="chatPanelCollapsed"
      :project-id="currentProjectId"
      :history-sessions="historySessions"
      :current-session-id="currentSessionId"
      :session-name="sessionName"
      @load-history-sessions="onLoadHistorySessions"
      @set-current-session-id="onSetCurrentSessionId"
      @send="onChatSend"
      @new-chat="onNewChat"
      @set-session-name="onSetSessionName"
    />
    <UpdateProjectName
      v-model:open="modalStore.updateProjectNameVisible"
      v-model:project-id="project_Id"
      v-model:project-name="projectName"
      @submit="onRefreshProjects"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { Node } from '@antv/x6';
import Canvas from '@/components/Canvas/index.vue';
import ChatSidePanel from './ChatSidePanel.vue';
import type { ChatSendPayload } from './chatTypes';
import { useRoute } from 'vue-router';
import api, { type ProjectCanvasResponse } from '@/services/api';
import { useModalStore } from '@stores/useModal'
import {
  normalizeImageCapabilities,
  type ImageCapability,
} from '@/components/Canvas/constants'

const ImageCapabilities = ref<ImageCapability[]>([])
const VideoCapabilities = ref<any[]>([])
const TextCapabilities = ref<any[]>([])
const modalStore = useModalStore();

const projectName = ref('');
const project_Id = ref('');
const historySessions = ref<any[]>([]);
const currentSessionId = ref('');
const sessionName = ref('');

type CanvasExpose = {
  addImagesFromFiles: (files: File[]) => Promise<Node[]>
  getNodeCount: () => number
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
const projectsList = ref<CanvasProjectItem[]>([]);
const chatPanelCollapsed = ref(true)
const currentProjectId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.trim() ? id : undefined
})
const canvasRef = ref<InstanceType<typeof Canvas> & CanvasExpose | null>(null)
const chatPanelRef = ref<InstanceType<typeof ChatSidePanel> | null>(null)

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

  try {
    const res = await api.getProjectCanvas(targetId)
    await nextTick()
    canvasRef.value?.loadProjectCanvas(res)
  } catch (error) {
    console.error('[CreateOrEdit] load project canvas failed', error)
  }
}

const onLoadProjects = async () => {
  const res = await api.getProjects({ page: 1, pageSize: 10 });
  projectsList.value = res.records as CanvasProjectItem[];
}

const onNewProject = async () => {
  const res = await api.createProject({ title: `未命名-${Date.now()}` });
  projectsList.value.push(res as CanvasProjectItem);
}

const onRenameProject = async (projectId: string, name: string) => {
  project_Id.value = projectId;
  projectName.value = name;
  modalStore.openModal('updateProjectName');
  onLoadProjects();
}

const onDeleteProject = async (projectId: string) => {
  await api.deleteProject(projectId);
  onLoadProjects();
}

/**
 * Refresh projects list
 */
const onRefreshProjects = () => {
  onLoadProjects();
}

const onLoadTools = async () => {
  /* const res = */ await api.getTools();
  // console.log('tools', res);
}

const onLoadWorkflows = async () => {
  /* const res = */ await api.getWorkflows({ page: 1, pageSize: 50 });
  // console.log('workflows', res);
}

const onLoadChatModels = async () => {
  /* const res = */ await api.getChatModels();
  // console.log('chatModels', res);
}

const onLoadHistorySessions = async () => {
  const res = await api.getChatSessions({ projectId: currentProjectId.value, page: 1, pageSize: 100 });
  historySessions.value = res.records as unknown as any[];

  if (historySessions.value.length) {
    const first = historySessions.value[0]
    sessionName.value = first?.title || '新建对话'
    // 仅在尚未选中会话时，默认切到第一条历史
    if (!currentSessionId.value) {
      currentSessionId.value = first.id;
      onLoadChatSession(first.id);
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

watch(
  () => route.params.id,
  (newId) => {
    if (typeof newId === 'string' && newId.trim()) {
      void onLoadProjectCanvas(newId)
    }
  },
  { immediate: true },
)

onMounted(() => {
  void onLoadHistorySessions();
  void onLoadWorkflows();
  void onLoadProjects();
  void onLoadTools();
  void onLoadChatModels();
  void onLoadAiCapabilities('TEXT');
  void onLoadAiCapabilities('IMAGE');
  void onLoadAiCapabilities('VIDEO');
});

</script>

<style scoped lang="scss">
@import './index.scss';
</style>
