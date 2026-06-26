<template>
  <div :class="`canvas__toolbar canvas__toolbar--left  ${canvasBgTheme === 'light' ? 'bg_white' : ''}`">
    <button
      type="button"
      class="canvas__tool-btn"
      :class="{ 'canvas__tool-btn--active': showAddMenu }"
      title="添加节点"
      @click="emit('toggle-add-menu')"
    >
      <i class="iconfont icon-tianjia" style="font-size: 18px;" />
    </button>
    <button
      type="button"
      class="canvas__tool-btn"
      :class="{ 'canvas__tool-btn--active': showAssetsPanel }"
      title="我的素材"
      @click="emit('toggle-assets-panel')"
    >
      <i class="iconfont icon-lishijilu1" style="font-size: 18px;" />
    </button>
    <button
      type="button"
      class="canvas__tool-btn"
      :class="{ 'canvas__tool-btn--active': showAssetCenterPanel }"
      title="资产中心"
      @click="emit('toggle-asset-center-panel')"
    >
      <i class="iconfont icon-gongzuoliucheng" style="font-size: 18px;" />
    </button>
    <button
      type="button"
      class="canvas__tool-btn"
      :class="{ 'canvas__tool-btn--active': showHistoryPanel }"
      title="历史记录"
      @click="emit('toggle-history-panel')"
    >
      <!-- <span class="canvas__history-icon" aria-hidden="true" /> -->
      <i class="iconfont icon-lishijilu1" style="font-size: 18px;" />
    </button>
    <a-popover placement="right">
      <template #content>
        <span>使用教程</span>
      </template>
      <button
        type="button"
        class="canvas__tool-btn"
        title="帮助"
      >
        <i class="iconfont icon-question-circle" style="font-size: 18px;" />
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
