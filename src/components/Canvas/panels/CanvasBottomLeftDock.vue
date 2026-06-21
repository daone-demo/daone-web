<template>
  <div class="canvas__bottom-left">
    <div v-show="showMinimap" ref="minimapContainerRef" class="canvas__minimap-host" />
    <CanvasBottomControls
      :show-minimap="showMinimap"
      :grid-visible="gridVisible"
      :show-shortcuts-panel="showShortcutsPanel"
      :pan-mode="panMode"
      :show-zoom-menu="showZoomMenu"
      :zoom-percent="zoomPercent"
      :theme-label="themeLabel"
      @toggle-theme="emit('toggle-theme')"
      @tidy="emit('tidy')"
      @toggle-minimap="emit('toggle-minimap')"
      @toggle-grid="emit('toggle-grid')"
      @toggle-shortcuts="emit('toggle-shortcuts')"
      @toggle-pan="emit('toggle-pan')"
      @toggle-zoom-menu="emit('toggle-zoom-menu')"
      @zoom-in="emit('zoom-in')"
      @zoom-out="emit('zoom-out')"
      @zoom-menu-action="(action, preset) => emit('zoom-menu-action', action, preset)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CanvasBottomControls from './CanvasBottomControls.vue'
import type { ZOOM_MENU_PRESETS } from '../constants'

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
  'zoom-menu-action': [
    action: 'in' | 'out' | 'fit' | 'preset',
    preset?: (typeof ZOOM_MENU_PRESETS)[number],
  ]
}>()

const minimapContainerRef = ref<HTMLElement | null>(null)

defineExpose({ minimapContainerRef })
</script>
