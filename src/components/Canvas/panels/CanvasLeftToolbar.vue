<template>
  <div :class="`canvas__toolbar canvas__toolbar--left  ${canvasBgTheme === 'light' ? 'bg_white' : ''}`">
    <a-popover placement="right">
      <template #content>
        <span>添加节点</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
        :class="{ 'canvas__tool-btn--active': showAddMenu }"
        @click="emit('toggle-add-menu')"
      >
        <i class="iconfont icon-tianjiajia" style="font-size: 18px;" />
      </button>
    </a-popover>
    <a-popover placement="right">
      <template #content>
        <span>素材中心</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
        :class="{ 'canvas__tool-btn--active': showAssetsPanel }"
        @click="emit('toggle-assets-panel')"
      >
        <i class="iconfont icon-icon-project" style="font-size: 18px;" />
      </button>
    </a-popover>
    <a-popover placement="right">
      <template #content>
        <span>我的工作流</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
        :class="{ 'canvas__tool-btn--active': showAssetCenterPanel }"
        @click="emit('toggle-asset-center-panel')"
      >
        <i class="iconfont icon-gongzuoliu" style="font-size: 18px;" />
      </button>
    </a-popover>
    <a-popover placement="right">
      <template #content>
        <span>历史记录</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
        :class="{ 'canvas__tool-btn--active': showHistoryPanel }"
        @click="emit('toggle-history-panel')"
      >
        <!-- <span class="canvas__history-icon" aria-hidden="true" /> -->
        <i class="iconfont icon-lishi" style="font-size: 18px;" />
      </button>
    </a-popover>
    <a-popover placement="right">
      <template #content>
        <span>使用教程</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
      >
        <i class="iconfont icon-yiwen2x-copy" style="font-size: 18px;" />
      </button>
    </a-popover>
  </div>
</template>

<script setup lang="ts">
import type { CanvasBgTheme } from '../canvasTheme'

defineProps<{
  canvasBgTheme: CanvasBgTheme
  showAddMenu: boolean
  showAssetsPanel: boolean
  showAssetCenterPanel: boolean
  showHistoryPanel: boolean
}>()

const emit = defineEmits<{
  'toggle-add-menu': []
  'toggle-assets-panel': []
  'toggle-asset-center-panel': []
  'toggle-history-panel': []
}>()
</script>
