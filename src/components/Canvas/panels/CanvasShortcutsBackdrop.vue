<template>
  <Transition name="canvas-shortcuts-fade">
    <div class="canvas__shortcuts-backdrop" @mousedown.self="emit('close')">
      <CanvasShortcutsPanel @close="emit('close')" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import CanvasShortcutsPanel from '../CanvasShortcutsPanel.vue'

const emit = defineEmits<{
  close: []
}>()
</script>
