<template>
  <section ref="el" class="chat-panel__messages">
    <ChatMessageItem
      v-for="item in messages"
      :key="item.id"
      :item="item"
      :streaming="streamingMessageIds.has(item.id)"
      :is-streaming="isStreaming"
      :is-sending="isSending"
      :is-processing="isProcessing"
      @pick-option="emit('pick-option', item, $event)"
      @custom-input="emit('custom-input', item, $event)"
      @prev="emit('prev', item)"
      @next="emit('next', item)"
    />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ChatMessage, QuestionnaireOption } from '../../chatTypes'
import ChatMessageItem from './ChatMessageItem.vue'

defineProps<{
  messages: ChatMessage[]
  streamingMessageIds: Set<string>
  isStreaming: boolean
  isSending: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  'pick-option': [message: ChatMessage, option: QuestionnaireOption]
  'custom-input': [message: ChatMessage, value: string]
  prev: [message: ChatMessage]
  next: [message: ChatMessage]
}>()

const el = ref<HTMLElement | null>(null)

defineExpose({ el })
</script>
