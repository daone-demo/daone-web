<template>
  <article
    class="chat-panel__message"
    :class="`chat-panel__message--${item.role}`"
  >
    <template v-if="item.kind === 'balance_error'">
      <div class="chat-panel__balance-card">
        <div class="chat-panel__balance-head">
          <span class="chat-panel__balance-icon" aria-hidden="true" />
          <span class="chat-panel__balance-title">余额不足 需要处理</span>
          <span class="chat-panel__balance-caret" aria-hidden="true" />
        </div>
        <p class="chat-panel__balance-desc">余额不足，请充值后重试。</p>
        <button type="button" class="chat-panel__balance-action">
          充值
          <span class="chat-panel__balance-link-icon" aria-hidden="true" />
        </button>
      </div>
    </template>
    <template v-else>
      <div v-if="item.attachments?.length" class="chat-panel__message-attachments">
        <img
          v-for="attachment in item.attachments"
          :key="attachment.id"
          :src="attachment.previewUrl"
          :alt="attachment.fileName"
          class="chat-panel__message-thumb"
        />
      </div>
      <div v-if="item.text" class="chat-panel__message-bubble">
        <div
          v-if="item.role === 'assistant'"
          class="chat-panel__message-text chat-panel__message-text--markdown"
        >
          <div
            class="chat-panel__message-markdown"
            v-html="renderMarkdown(item.text)"
          />
          <span
            v-if="streaming"
            class="chat-panel__stream-caret"
            aria-hidden="true"
          />
        </div>
        <p
          v-else
          class="chat-panel__message-text"
        >
          {{ item.text }}
        </p>
      </div>
      <ChatQuestionnaire
        :message="item"
        :disabled="isStreaming || isSending"
        @pick-option="emit('pick-option', $event)"
        @custom-input="emit('custom-input', $event)"
        @prev="emit('prev')"
        @next="emit('next')"
      />
      <!-- <button
        v-if="item.role === 'user' && item.text"
        type="button"
        class="chat-panel__copy-btn"
        title="复制"
        aria-label="复制"
        @click="copyMessage(item.text)"
      >
        <span class="chat-panel__copy-icon" aria-hidden="true" />
      </button> -->
      <ChatThinkingTip
        :tip="item.tip"
        :tip-wave="item.tipWave"
        :role="item.role"
        :animate="shouldAnimateTip(item, isStreaming, isProcessing)"
      />
    </template>
  </article>
</template>

<script setup lang="ts">
import type { ChatMessage, QuestionnaireOption } from '../../chatTypes'
import { renderMarkdown, shouldAnimateTip } from '../chatMarkdown'
import ChatQuestionnaire from './ChatQuestionnaire.vue'
import ChatThinkingTip from './ChatThinkingTip.vue'

defineProps<{
  item: ChatMessage
  streaming: boolean
  isStreaming: boolean
  isSending: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  'pick-option': [option: QuestionnaireOption]
  'custom-input': [value: string]
  prev: []
  next: []
}>()
</script>
