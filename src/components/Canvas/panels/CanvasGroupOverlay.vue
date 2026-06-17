<template>
  <div
    class="canvas__group-overlay"
    :class="{ 'canvas__group-overlay--light': isLight }"
    :style="overlayStyle"
    @mousedown.stop="onOverlayMouseDown"
  >
    <div class="canvas__group-label">分组 {{ nodeCount }} 个节点</div>
    <div class="canvas__group-frame">
      <span
        v-for="handle in handles"
        :key="handle"
        class="canvas__group-handle"
        :class="`canvas__group-handle--${handle}`"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  box: { left: number; top: number; width: number; height: number }
  nodeCount: number
  isLight?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [event: MouseEvent]
}>()

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

const overlayStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
}))

function onOverlayMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  emit('drag-start', event)
}
</script>
