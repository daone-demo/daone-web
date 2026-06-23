<template>
  <div class="create-or-edit">
    <Canvas
      ref="canvasRef"
      @focus-chat="focusChatPanel"
      @add-to-chat="onAddToChat"
      :projects-list="projectsList"
      @new-project="onNewProject"
      @rename-project="onRenameProject"
      @delete-project="onDeleteProject"
    />
    <ChatSidePanel
      ref="chatPanelRef"
      v-model:collapsed="chatPanelCollapsed"
      @send="onChatSend"
      @new-chat="onNewChat"
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
import { nextTick, onMounted, ref, watch } from 'vue';
import type { Node } from '@antv/x6';
import Canvas from '@/components/Canvas/index.vue';
import ChatSidePanel from './ChatSidePanel.vue';
import type { ChatSendPayload } from './chatTypes';
import { useRoute } from 'vue-router';
import api, { type ProjectCanvasResponse } from '@/services/api';
import { useModalStore } from '@stores/useModal';
const modalStore = useModalStore();

const projectName = ref('');
const project_Id = ref('');
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
const canvasRef = ref<InstanceType<typeof Canvas> & CanvasExpose | null>(null)
const chatPanelRef = ref<InstanceType<typeof ChatSidePanel> | null>(null)

function focusChatPanel() {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.focusInput()
}

function onAddToChat(payload: { previewUrl: string; fileName: string }) {
  chatPanelCollapsed.value = false
  chatPanelRef.value?.addAttachmentFromCanvas(payload)
}

async function onChatSend(payload: ChatSendPayload) {
  const canvas = canvasRef.value
  if (!canvas) return

  const files = payload.attachments
    .filter((item) => item.file.type.startsWith('image/'))
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
  const res = await api.createProject({ title: `新项目-${Date.now()}` });
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
  void onLoadProjects()
});
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
