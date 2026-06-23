<template>
  <div
    class="canvas__group-toolbar"
    :class="{ 'canvas__group-toolbar--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <div class="canvas__group-layout-wrap">
      <button
        type="button"
        class="canvas__group-btn canvas__group-btn--icon"
        :class="{ 'canvas__group-btn--active': showLayoutMenu }"
        title="整理布局"
        @click="toggleLayoutMenu"
      >
        <span class="canvas__group-icon" data-icon="layout" aria-hidden="true" />
      </button>
      <div v-if="showLayoutMenu" class="canvas__group-layout-menu" @mousedown.stop>
        <button
          v-for="item in LAYOUT_MENU_ITEMS"
          :key="item.key"
          type="button"
          class="canvas__group-layout-menu-item"
          @click="onLayout(item.key)"
        >
          <span class="canvas__group-icon" :data-icon="item.icon" aria-hidden="true" />
          {{ item.label }}
        </button>
      </div>
    </div>
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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { GroupLayoutDirection } from '../layout'

defineProps<{
  position: { left: number; top: number }
  isLight?: boolean
}>()

const emit = defineEmits<{
  layout: [direction: GroupLayoutDirection]
  execute: []
  'add-to-toolbox': []
  'to-storyboard': []
  ungroup: []
  'batch-download': []
}>()

const LAYOUT_MENU_ITEMS: { key: GroupLayoutDirection; label: string; icon: string }[] = [
  { key: 'grid', label: '宫格排列', icon: 'layout-grid' },
  { key: 'horizontal', label: '水平排列', icon: 'layout-horizontal' },
  { key: 'vertical', label: '垂直排列', icon: 'layout-vertical' },
]

const showLayoutMenu = ref(false)

function toggleLayoutMenu() {
  showLayoutMenu.value = !showLayoutMenu.value
}

function closeLayoutMenu() {
  showLayoutMenu.value = false
}

function onLayout(direction: GroupLayoutDirection) {
  closeLayoutMenu()
  emit('layout', direction)
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.canvas__group-layout-wrap')) return
  closeLayoutMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
})
</script>
