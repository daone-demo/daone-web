<template>
  <div
    v-if="tip"
    class="chat-panel__message-tip"
  >
    <div
      v-if="animate"
      class="chat-panel__thinking"
      :class="{ 'chat-panel__thinking--wave': tipWave }"
    >
      <span
        v-if="role === 'user'"
        class="chat-panel__thinking-dots"
        aria-hidden="true"
      >
        <span
          v-for="dotIndex in 5"
          :key="dotIndex"
          class="chat-panel__thinking-dot"
          :style="{ animationDelay: `${(dotIndex - 1) * 0.14}s` }"
        />
      </span>
      <span class="chat-panel__thinking-text">
        <span
          v-for="(segment, index) in splitTipSegments(tip)"
          :key="`${index}-${segment.char}`"
          class="chat-panel__thinking-char"
          :class="{ 'is-space': segment.isSpace }"
          :style="{ animationDelay: `${index * 0.06}s` }"
        >{{ segment.char }}</span>
      </span>
    </div>
    <div
      v-else
      v-html="renderMarkdown(tip)"
    />
  </div>
</template>

<script setup lang="ts">
import { renderMarkdown, splitTipSegments } from '../chatMarkdown'

defineProps<{
  tip?: string
  tipWave?: boolean
  role: 'user' | 'assistant' | 'system'
  animate: boolean
}>()
</script>
