<template>
  <div
    ref="rootRef"
    class="canvas__image-resize-overlay"
    :class="{ 'canvas__image-resize-overlay--hidden': !visible }"
    :style="boxStyle"
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
import { computed, ref } from 'vue'
import type { ImageResizeCorner } from '../graph'

export type ImageResizeOverlayBox = {
  left: number
  top: number
  width: number
  height: number
}

const props = defineProps<{
  visible: boolean
  box: ImageResizeOverlayBox
  dimensionLabel: string
}>()

const emit = defineEmits<{
  'resize-start': [event: MouseEvent, corner: ImageResizeCorner]
}>()

const rootRef = ref<HTMLElement | null>(null)

const boxStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
}))

const handles: Array<{ corner: ImageResizeCorner; title: string }> = [
  { corner: 'nw', title: '缩放' },
  { corner: 'ne', title: '缩放' },
  { corner: 'sw', title: '缩放' },
  { corner: 'se', title: '缩放' },
]

function applyBox(box: ImageResizeOverlayBox | null) {
  const el = rootRef.value
  if (!el) return
  if (!box) {
    el.style.display = 'none'
    return
  }
  el.style.display = ''
  el.style.left = `${box.left}px`
  el.style.top = `${box.top}px`
  el.style.width = `${box.width}px`
  el.style.height = `${box.height}px`
}

defineExpose({
  applyBox,
})
</script>
