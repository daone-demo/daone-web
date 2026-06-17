<template>
  <div
    class="canvas__multi-select-toolbar"
    :class="{ 'canvas__multi-select-toolbar--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <button type="button" class="canvas__multi-select-btn canvas__multi-select-btn--icon" title="整理布局" @click="emit('layout')">
      <span class="canvas__multi-select-icon" data-icon="layout" aria-hidden="true" />
    </button>
    <button type="button" class="canvas__multi-select-btn" title="保存到资产" @click="emit('save-to-assets')">
      <span class="canvas__multi-select-icon" data-icon="assets" aria-hidden="true" />
      保存到资产
    </button>
    <button type="button" class="canvas__multi-select-btn" title="创建副本" @click="emit('duplicate')">
      <span class="canvas__multi-select-icon" data-icon="duplicate" aria-hidden="true" />
      创建副本
    </button>
    <button type="button" class="canvas__multi-select-btn canvas__multi-select-btn--icon" title="复制" @click="emit('copy')">
      <span class="canvas__multi-select-icon" data-icon="copy" aria-hidden="true" />
    </button>
    <div class="canvas__multi-select-group-wrap">
      <button
        type="button"
        class="canvas__multi-select-btn"
        :class="{ 'canvas__multi-select-btn--active': showGroupMenu }"
        title="打组"
        @click="toggleGroupMenu"
      >
        <span class="canvas__multi-select-icon" data-icon="group" aria-hidden="true" />
        打组
        <span class="canvas__multi-select-caret" aria-hidden="true" />
      </button>
      <div v-if="showGroupMenu" class="canvas__multi-select-menu" @mousedown.stop>
        <button type="button" class="canvas__multi-select-menu-item" @click="onGroup">
          <span class="canvas__multi-select-icon" data-icon="group" aria-hidden="true" />
          打组
        </button>
        <button type="button" class="canvas__multi-select-menu-item" @click="onMergeStoryboard">
          <span class="canvas__multi-select-icon" data-icon="merge-storyboard" aria-hidden="true" />
          合并分镜组
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  position: { left: number; top: number }
  isLight?: boolean
}>()

const emit = defineEmits<{
  layout: []
  'save-to-assets': []
  duplicate: []
  copy: []
  group: []
  'merge-storyboard': []
}>()

const showGroupMenu = ref(false)

function toggleGroupMenu() {
  showGroupMenu.value = !showGroupMenu.value
}

function closeGroupMenu() {
  showGroupMenu.value = false
}

function onGroup() {
  closeGroupMenu()
  emit('group')
}

function onMergeStoryboard() {
  closeGroupMenu()
  emit('merge-storyboard')
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.canvas__multi-select-group-wrap')) return
  closeGroupMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
})
</script>
