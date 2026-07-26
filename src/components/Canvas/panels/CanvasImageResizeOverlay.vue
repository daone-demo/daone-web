<template>
  <div
    v-if="visible"
    class="canvas__image-resize-overlay"
    :style="{
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    }"
    @mousedown.stop
  >
    <span v-if="dimensionLabel" class="canvas__image-resize-size">{{ dimensionLabel }}</span>
    <button
      v-for="handle in handles"
      :key="handle.corner"
      type="button"
      class="canvas__image-resize-handle"
      :class="`canvas__image-resize-handle--${handle.corner}`"
      :title="handle.title"
      @mousedown.stop="emit('resize-start', $event, handle.corner)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ImageResizeCorner } from '../graph'

defineProps<{
  visible: boolean
  box: { left: number; top: number; width: number; height: number }
  dimensionLabel: string
}>()

const emit = defineEmits<{
  'resize-start': [event: MouseEvent, corner: ImageResizeCorner]
}>()

const handles: Array<{ corner: ImageResizeCorner; title: string }> = [
  { corner: 'nw', title: '缩放' },
  { corner: 'ne', title: '缩放' },
  { corner: 'sw', title: '缩放' },
  { corner: 'se', title: '缩放' },
]
</script>
