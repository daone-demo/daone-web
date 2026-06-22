<template>
  <div class="create-or-edit">
    <Canvas
      ref="canvasRef"
      @focus-chat="focusChatPanel"
      @add-to-chat="onAddToChat"
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

const route = useRoute();
const projectId = route.params.id as string;

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
  console.log('res', res);
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

onMounted(() => {
  if (projectId && projectId.trim() !== '') {
    onLoadProject();
    onLoadProjectCanvas();
  }
});
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
