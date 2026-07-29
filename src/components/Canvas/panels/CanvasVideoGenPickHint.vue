<template>
  <div
    class="canvas__video-gen-pick-hint"
    :class="{ 'canvas__video-gen-pick-hint--light': isLightTheme }"
    @mousedown.stop
  >
    请点击画布中的图片
  </div>
</template>

<script setup lang="ts">
import { useCanvasBgTheme } from '../useCanvasBgTheme'

const { isLightTheme } = useCanvasBgTheme()
</script>
