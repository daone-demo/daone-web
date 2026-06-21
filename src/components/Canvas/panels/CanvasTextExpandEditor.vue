<template>
  <div
    class="canvas__text-expand"
    :class="{ 'canvas__text-expand--light': isLight }"
    @mousedown.stop
  >
    <div class="canvas__text-expand-head">
      <span>{{ title }}</span>
      <button type="button" class="canvas__text-expand-close" @click="emit('close')">×</button>
    </div>
    <div
      ref="editorRef"
      class="canvas__text-expand-body"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="emit('input')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  placeholder: string
  isLight: boolean
}>()

const emit = defineEmits<{
  close: []
  input: []
}>()

const editorRef = ref<HTMLElement | null>(null)

defineExpose({ editorRef })
</script>
