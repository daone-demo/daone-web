import { computed, ref } from 'vue'
import type { CanvasBgTheme } from './canvasTheme'

const sharedCanvasBgTheme = ref<CanvasBgTheme>('light')

export function setSharedCanvasBgTheme(theme: CanvasBgTheme) {
  sharedCanvasBgTheme.value = theme
}

export function useCanvasBgTheme() {
  return {
    canvasBgTheme: sharedCanvasBgTheme,
    isLightTheme: computed(() => sharedCanvasBgTheme.value === 'light'),
  }
}
