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
import { ref } from 'vue'
import type { Node } from '@antv/x6'
import Canvas from '@/components/Canvas/index.vue'
import ChatSidePanel from './ChatSidePanel.vue'
import type { ChatSendPayload } from './chatTypes'

type CanvasExpose = {
  addImagesFromFiles: (files: File[]) => Promise<Node[]>
  getNodeCount: () => number
}

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
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
