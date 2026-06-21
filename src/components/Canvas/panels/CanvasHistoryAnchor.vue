<template>
  <div class="canvas__history-anchor" @mousedown.stop>
    <CanvasHistoryPanel @close="emit('close')" />
  </div>
</template>

<script setup lang="ts">
import CanvasHistoryPanel from '../CanvasHistoryPanel.vue'

const emit = defineEmits<{
  close: []
}>()
</script>
