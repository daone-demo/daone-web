import { ref, type Ref } from 'vue'
import { CANVAS_IMAGE_NODE_DRAG_TYPE } from '../constants'

interface UseCanvasImageDropUploadOptions {
  canAccept?: () => boolean
  fileInputRef?: Ref<HTMLInputElement | null>
  onAddCanvasNode: (nodeId: string) => void
  onUploadImages: (files: File[]) => void
}

export function useCanvasImageDropUpload(options: UseCanvasImageDropUploadOptions) {
  const isDragOver = ref(false)
  const fileInputRef = options.fileInputRef ?? ref<HTMLInputElement | null>(null)

  function canAcceptDrop() {
    return options.canAccept?.() ?? true
  }

  function hasDropContent(event: DragEvent) {
    const types = Array.from(event.dataTransfer?.types ?? [])
    return types.includes('Files') || types.includes(CANVAS_IMAGE_NODE_DRAG_TYPE)
  }

  function onDragEnter(event: DragEvent) {
    if (!canAcceptDrop() || !hasDropContent(event)) return
    isDragOver.value = true
  }

  function onDragOver(event: DragEvent) {
    if (!canAcceptDrop() || !hasDropContent(event)) return
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    isDragOver.value = true
  }

  function onDragLeave(event: DragEvent) {
    const related = event.relatedTarget as Node | null
    const current = event.currentTarget as HTMLElement | null
    if (related && current?.contains(related)) return
    isDragOver.value = false
  }

  function onDrop(event: DragEvent) {
    isDragOver.value = false
    if (!canAcceptDrop()) return

    const nodeId = event.dataTransfer?.getData(CANVAS_IMAGE_NODE_DRAG_TYPE)
    if (nodeId) {
      options.onAddCanvasNode(nodeId)
      return
    }

    uploadImageFiles(event.dataTransfer?.files)
  }

  function uploadImageFiles(fileList: FileList | null | undefined) {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'))
    if (files.length) options.onUploadImages(files)
  }

  function openFilePicker() {
    fileInputRef.value?.click()
  }

  function onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    uploadImageFiles(input.files)
    input.value = ''
  }

  return {
    isDragOver,
    fileInputRef,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    openFilePicker,
    onFileInputChange,
  }
}
