<template>
  <div class="canvas__toolbar canvas__toolbar--bottom">
      <a-popover placement="top">
        <template #content>
          <span>画布背景：{{ themeLabel }}</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn canvas__tool-btn--theme"
          @click="emit('toggle-theme')"
        >
          <i class="iconfont icon-heibaimoshi" style="font-size: 18px;"></i>
          <!-- <span class="canvas__theme-tooltip">画布背景：{{ themeLabel }}</span> -->
        </button>
      </a-popover>
      <a-popover placement="top">
        <template #content>
          <span>整理画布</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn canvas__tool-btn--tidy"
          @click="emit('tidy')"
        >
          <i class="iconfont icon-zidongzhengli" style="font-size: 18px;"></i>
        </button>
      </a-popover>
      <a-popover placement="top">
        <template #content>
          <span>画布小地图</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn"
          :class="{ 'canvas__tool-btn--active': showMinimap }"
          @click="emit('toggle-minimap')"
        >
          <i class="iconfont icon-yulan" style="font-size: 18px;"></i>
        </button>
      </a-popover>
      <a-popover placement="top">
        <template #content>
          <span>网格</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn"
          :class="{ 'canvas__tool-btn--active': gridVisible }"
          @click="emit('toggle-grid')"
        >
          <i class="iconfont icon-TSPxuanfukeli" style="font-size: 18px;"></i>
        </button>
      </a-popover>
      <a-popover placement="top">
        <template #content>
          <span>快捷键</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn"
          :class="{ 'canvas__tool-btn--active': showShortcutsPanel }"
          @click="emit('toggle-shortcuts')"
        >
          <i class="iconfont icon-jianpan" style="font-size: 18px;"></i>
        </button>
      </a-popover>
      <a-popover placement="top">
        <template #content>
          <span>拖动画布</span>
        </template>
        <button
          type="button"
          class="canvas__tool-btn"
          :class="{ 'canvas__tool-btn--active': panMode }"
          @click="emit('toggle-pan')"
        >
          <i class="iconfont icon-zhuashou" style="font-size: 18px;"></i>
        </button>
      </a-popover>
      <div class="canvas__zoom">
        <a-popover placement="top">
          <template #content>
            <span>缩小</span>
          </template>
          <button type="button" class="canvas__tool-btn" @click="emit('zoom-out')">
            <i class="iconfont icon-jian" style="font-size: 18px;"></i>
          </button>
        </a-popover>
        <div class="canvas__zoom-trigger-wrap">
          <a-popover placement="top">
            <template #content>
              <span>当前缩放 {{zoomPercent}}}</span>
            </template>
            <button
              type="button"
              class="canvas__zoom-value-btn"
              :class="{ 'canvas__zoom-value-btn--active': showZoomMenu }"
              @click.stop="emit('toggle-zoom-menu')"
            >
              {{ zoomPercent }}
            </button>
          </a-popover>
          <div
            v-if="showZoomMenu"
            class="canvas__zoom-menu"
            role="menu"
            @mousedown.stop
          >
            <button
              type="button"
              class="canvas__zoom-menu-item"
              role="menuitem"
              @click="emit('zoom-menu-action', 'in')"
            >
              <span>放大</span>
              <kbd class="canvas__zoom-menu-kbd">⌘ +</kbd>
            </button>
            <button
              type="button"
              class="canvas__zoom-menu-item"
              role="menuitem"
              @click="emit('zoom-menu-action', 'out')"
            >
              <span>缩小</span>
              <kbd class="canvas__zoom-menu-kbd">⌘ -</kbd>
            </button>
            <button
              type="button"
              class="canvas__zoom-menu-item"
              role="menuitem"
              @click="emit('zoom-menu-action', 'fit')"
            >
              <span>适合屏幕</span>
              <kbd class="canvas__zoom-menu-kbd">⇧ 1</kbd>
            </button>
            <div class="canvas__zoom-menu-divider" role="separator" />
            <button
              v-for="preset in ZOOM_MENU_PRESETS"
              :key="preset"
              type="button"
              class="canvas__zoom-menu-item"
              role="menuitem"
              @click="emit('zoom-menu-action', 'preset', preset)"
            >
              <span>缩放至{{ Math.round(preset * 100) }}%</span>
            </button>
          </div>
        </div>
        <a-popover placement="top">
          <template #content>
            <span>放大</span>
          </template>
          <button type="button" class="canvas__tool-btn" @click="emit('zoom-in')">
            <i class="iconfont icon-jia" style="font-size: 18px;"></i>
          </button>
        </a-popover>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ZOOM_MENU_PRESETS } from '../constants'

defineProps<{
  showMinimap: boolean
  gridVisible: boolean
  showShortcutsPanel: boolean
  panMode: boolean
  showZoomMenu: boolean
  zoomPercent: string
  themeLabel: string
}>()

const emit = defineEmits<{
  'toggle-theme': []
  tidy: []
  'toggle-minimap': []
  'toggle-grid': []
  'toggle-shortcuts': []
  'toggle-pan': []
  'toggle-zoom-menu': []
  'zoom-in': []
  'zoom-out': []
  'zoom-menu-action': [action: 'in' | 'out' | 'fit' | 'preset', preset?: (typeof ZOOM_MENU_PRESETS)[number]]
}>()
</script>
