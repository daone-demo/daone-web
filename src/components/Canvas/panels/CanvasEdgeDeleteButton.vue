<template>
  <button
    type="button"
    class="canvas__edge-delete-btn"
    :class="{ 'canvas__edge-delete-btn--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    title="删除连线"
    @mousedown.stop
    @click="emit('delete')"
    @mouseenter="emit('pointer-enter')"
    @mouseleave="emit('pointer-leave')"
  >
    <span class="canvas__edge-delete-btn-icon" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  position: { left: number; top: number }
  isLight?: boolean
}>()

const emit = defineEmits<{
  delete: []
  'pointer-enter': []
  'pointer-leave': []
}>()
</script>
