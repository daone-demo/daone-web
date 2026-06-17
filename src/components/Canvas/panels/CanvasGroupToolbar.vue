<template>
  <div
    class="canvas__group-toolbar"
    :class="{ 'canvas__group-toolbar--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <button type="button" class="canvas__group-btn canvas__group-btn--icon" title="整理布局" @click="emit('layout')">
      <span class="canvas__group-icon" data-icon="layout" aria-hidden="true" />
    </button>
    <button type="button" class="canvas__group-btn" title="整组执行" @click="emit('execute')">
      <span class="canvas__group-icon" data-icon="execute" aria-hidden="true" />
      整组执行
    </button>
    <button type="button" class="canvas__group-btn" title="添加到工具箱" @click="emit('add-to-toolbox')">
      <span class="canvas__group-icon" data-icon="toolbox" aria-hidden="true" />
      添加到工具箱
    </button>
    <button type="button" class="canvas__group-btn" title="转分镜组" @click="emit('to-storyboard')">
      <span class="canvas__group-icon" data-icon="storyboard" aria-hidden="true" />
      转分镜组
    </button>
    <button type="button" class="canvas__group-btn" title="解组" @click="emit('ungroup')">
      <span class="canvas__group-icon" data-icon="ungroup" aria-hidden="true" />
      解组
    </button>
    <button type="button" class="canvas__group-btn" title="批量下载" @click="emit('batch-download')">
      <span class="canvas__group-icon" data-icon="download" aria-hidden="true" />
      批量下载
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  position: { left: number; top: number }
  isLight?: boolean
}>()

const emit = defineEmits<{
  layout: []
  execute: []
  'add-to-toolbox': []
  'to-storyboard': []
  ungroup: []
  'batch-download': []
}>()
</script>
