<template>
  <div
    class="canvas__multi-select-toolbar"
    :class="{ 'canvas__multi-select-toolbar--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <div class="canvas__multi-select-layout-wrap">
      <button
        type="button"
        class="canvas__multi-select-btn canvas__multi-select-btn--icon"
        :class="{ 'canvas__multi-select-btn--active': showLayoutMenu }"
        title="整理布局"
        @click="toggleLayoutMenu"
      >
        <span class="canvas__multi-select-icon" data-icon="layout" aria-hidden="true" />
      </button>
      <div v-if="showLayoutMenu" class="canvas__multi-select-layout-menu" @mousedown.stop>
        <button
          v-for="item in LAYOUT_MENU_ITEMS"
          :key="item.key"
          type="button"
          class="canvas__multi-select-layout-menu-item"
          @click="onLayout(item.key)"
        >
          <span class="canvas__multi-select-icon" :data-icon="item.icon" aria-hidden="true" />
          {{ item.label }}
        </button>
      </div>
    </div>
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
        title="打组"
        @click="emit('group')"
      >
        <span class="canvas__multi-select-icon" data-icon="group" aria-hidden="true" />
        打组
      </button>
      <!-- <div v-if="showGroupMenu" class="canvas__multi-select-menu" @mousedown.stop>
        <button type="button" class="canvas__multi-select-menu-item" @click="emit('group')">
          <span class="canvas__multi-select-icon" data-icon="group" aria-hidden="true" />
          打组
        </button>
        <button type="button" class="canvas__multi-select-menu-item" @click="emit('merge-storyboard')">
          <span class="canvas__multi-select-icon" data-icon="merge-storyboard" aria-hidden="true" />
          合并分镜组
        </button>
      </div> -->
    </div>
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
  'save-to-assets': []
  duplicate: []
  copy: []
  group: []
  'merge-storyboard': []
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
  if (target instanceof Element && target.closest('.canvas__multi-select-layout-wrap')) return
  closeLayoutMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
})
</script>
