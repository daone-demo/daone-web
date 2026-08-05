<template>
  <div
    class="canvas-gen-fail"
    :class="{ 'canvas-gen-fail--light': light }"
  >
    <svg
      class="canvas-gen-fail__icon"
      viewBox="0 0 48 48"
      width="48"
      height="48"
      aria-hidden="true"
    >
      <path
        d="M24 6L44 40H4L24 6Z"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M24 18V28"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <circle cx="24" cy="34" r="1.6" fill="currentColor" />
    </svg>

    <p class="canvas-gen-fail__title">生成失败</p>
    <p class="canvas-gen-fail__message">{{ message }}</p>

    <div
      v-if="taskId"
      class="canvas-gen-fail__task"
    >
      <span class="canvas-gen-fail__task-label">TaskID: {{ taskId }}</span>
      <button
        type="button"
        class="canvas-gen-fail__copy"
        title="复制 TaskID"
        @mousedown.stop
        @click.stop="copyTaskId"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="5" y="5" width="9" height="9" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2" />
          <path
            d="M3 11V3.8A.8.8 0 0 1 3.8 3H11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { DEFAULT_GENERATION_FAIL_MESSAGE } from '../constants'

const props = withDefaults(
  defineProps<{
    message?: string
    taskId?: string
    light?: boolean
  }>(),
  {
    message: DEFAULT_GENERATION_FAIL_MESSAGE,
    taskId: '',
    light: false,
  },
)

const copied = ref(false)

async function copyTaskId() {
  const text = String(props.taskId ?? '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      copied.value = true
      window.setTimeout(() => {
        copied.value = false
      }, 1500)
    } catch {
      // ignore clipboard errors
    }
  }
}
</script>

<style scoped lang="scss">
@import './node-generation-fail.scss';
</style>
