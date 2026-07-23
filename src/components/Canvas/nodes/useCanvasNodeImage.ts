import { computed, ref, watch, type Ref } from 'vue'
import { getCanvasImageDisplayUrl } from '../imageDisplayUrl'

export function useCanvasNodeImage(previewUrl: Ref<string | undefined>) {
  const isImageLoading = ref(false)
  const hasImageError = ref(false)

  const displayUrl = computed(() => {
    const url = previewUrl.value?.trim()
    return url ? getCanvasImageDisplayUrl(url) : ''
  })

  watch(
    displayUrl,
    (url) => {
      if (!url) {
        isImageLoading.value = false
        hasImageError.value = false
        return
      }
      isImageLoading.value = true
      hasImageError.value = false
    },
    { immediate: true },
  )

  function onImageLoad() {
    isImageLoading.value = false
    hasImageError.value = false
  }

  function onImageError() {
    isImageLoading.value = false
    hasImageError.value = true
  }

  return {
    displayUrl,
    isImageLoading,
    hasImageError,
    onImageLoad,
    onImageError,
  }
}
