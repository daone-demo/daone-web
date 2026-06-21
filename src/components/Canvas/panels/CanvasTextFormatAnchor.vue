<template>
  <div
    class="canvas__text-format-anchor"
    :style="{
      left: `${position.left}px`,
      top: `${position.top}px`,
      width: `${position.width}px`,
    }"
    @mousedown.stop
  >
    <TextFormatToolbar @command="(cmd, value) => emit('command', cmd, value)" />
  </div>
</template>

<script setup lang="ts">
import TextFormatToolbar from '../TextFormatToolbar.vue'
import type { TextFormatCommand } from '../constants'

defineProps<{
  position: { left: number; top: number; width: number }
}>()

const emit = defineEmits<{
  command: [cmd: TextFormatCommand, value?: string]
}>()
</script>
