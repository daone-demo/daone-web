<template>
  <div class="create-or-edit">
    <Canvas
      ref="canvasRef"
      @focus-chat="focusChatPanel"
      @add-to-chat="onAddToChat"
      :projects-list="projectsList"
      @new-project="onNewProject"
    />
    <ChatSidePanel
      ref="chatPanelRef"
      v-model:collapsed="chatPanelCollapsed"
      @send="onChatSend"
      @new-chat="onNewChat"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import type { Node } from '@antv/x6';
import Canvas from '@/components/Canvas/index.vue';
import ChatSidePanel from './ChatSidePanel.vue';
import type { ChatSendPayload } from './chatTypes';
import { useRoute } from 'vue-router';
import api, { type ProjectCanvasResponse } from '@/services/api';

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
const projectId = route.params.id as string;
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
 * Load project
 */
const onLoadProject = async () => {
  const res = await api.getProject(projectId);
  // console.log('res', res);
}

/**
 * Load project canvas
 */
const onLoadProjectCanvas = async () => {
  try {
    const res = await api.getProjectCanvas(projectId)
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

onMounted(() => {
  if (projectId && projectId.trim() !== '') {
    onLoadProject();
    onLoadProjectCanvas();
    onLoadProjects();
  }
});
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
