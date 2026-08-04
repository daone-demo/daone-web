<template>
  <div
    v-for="(item, index) in positions"
    :key="index"
    class="canvas__image-mark-hint"
    :class="{ 'canvas__image-mark-hint--light': isLightTheme }"
    :style="{ left: `${item.left}px`, top: `${item.top}px` }"
  >
    请点击图片添加标记
  </div>
</template>

<script setup lang="ts">
import { useCanvasBgTheme } from '../useCanvasBgTheme'

defineProps<{
  positions: Array<{ left: number; top: number }>
}>()

const { isLightTheme } = useCanvasBgTheme()
</script>
