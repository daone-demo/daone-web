<template>
  <div class="canvas__history-anchor" @mousedown.stop>
    <CanvasHistoryPanel :list="list" @close="emit('close')" />
  </div>
</template>

<script setup lang="ts">
import CanvasHistoryPanel from '../CanvasHistoryPanel.vue'

const emit = defineEmits<{
  close: []
}>()

defineProps<{
  list: any[]
}>()
</script>
