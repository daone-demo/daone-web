<template>
  <div
    class="canvas__element-select"
    :class="{ 'canvas__element-select--light': isLightTheme }"
    @mousedown.stop
  >
    <div class="canvas__element-select-icon" aria-hidden="true">✦</div>
    <div class="canvas__element-select-text">
      <p class="canvas__element-select-title">元素选择模式</p>
      <p class="canvas__element-select-desc">点击图片选择局部元素</p>
    </div>
    <button type="button" class="canvas__element-select-btn" @click="emit('return-node')">
      <span aria-hidden="true">↩</span>
      返回节点
    </button>
    <button type="button" class="canvas__element-select-exit" @click="emit('exit')">
      退出
      <span aria-hidden="true">×</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useCanvasBgTheme } from '../useCanvasBgTheme'

const { isLightTheme } = useCanvasBgTheme()

const emit = defineEmits<{
  'return-node': []
  exit: []
}>()
</script>
