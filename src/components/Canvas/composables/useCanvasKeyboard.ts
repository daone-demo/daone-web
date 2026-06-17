import { ref, type Ref, type ShallowRef } from 'vue'
import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'

type CanvasKeyboardDeps = {
  graph: ShallowRef<Graph | null>
  panMode: Ref<boolean>
  selectedNodeId: Ref<string>
  cancelCurrentOperation: () => boolean
  zoomIn: () => void
  zoomOut: () => void
  zoomToScale: (scale: number) => void
  zoomFitToScreen: () => void
  handleSaveCanvas: () => void
  copySelectedNode: () => void
  pasteNode: () => void
  handleUndo: () => void
  handleRedo: () => void
  moveNodeLayer: (step: 'front' | 'back' | 'forward' | 'backward') => void
  openImageDialogue: (nodeId?: string) => void
  getSelectedNode: () => Node | null
  removeSelectedNodes: () => void
  removeSelectedEdge: () => boolean
  hasSelectedNodes: () => boolean
  hasSelectedEdge: () => boolean
  openImagePreview: () => void
  triggerCanvasUploadShortcut: () => void
  getScroller: (graph: Graph) => { togglePanning: (enabled: boolean) => unknown } | null
  setRubberbandEnabled: (enabled: boolean) => void
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useCanvasKeyboard(deps: CanvasKeyboardDeps) {
  const spacePanActive = ref(false)
  const spaceKeyDownAt = ref(0)
  const altVoiceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  function beginSpacePan() {
    const scroller = deps.graph.value ? deps.getScroller(deps.graph.value) : null
    if (!scroller || spacePanActive.value) return
    spacePanActive.value = true
    deps.setRubberbandEnabled(false)
    if (!deps.panMode.value) scroller.togglePanning(true)
  }

  function endSpacePan() {
    const scroller = deps.graph.value ? deps.getScroller(deps.graph.value) : null
    if (!scroller || !spacePanActive.value) return
    spacePanActive.value = false
    scroller.togglePanning(deps.panMode.value)
    deps.setRubberbandEnabled(!deps.panMode.value)
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target
    if (isEditableTarget(target)) return

    const mod = event.metaKey || event.ctrlKey
    const key = event.key

    if (key === 'Escape') {
      if (deps.cancelCurrentOperation()) {
        event.preventDefault()
      }
      return
    }

    if (key === ' ' && !mod && !event.altKey) {
      if (!event.repeat) {
        spaceKeyDownAt.value = Date.now()
        beginSpacePan()
      }
      event.preventDefault()
      return
    }

    if (mod && (key === '=' || key === '+')) {
      event.preventDefault()
      deps.zoomIn()
      return
    }
    if (mod && key === '-') {
      event.preventDefault()
      deps.zoomOut()
      return
    }
    if (mod && key === '0') {
      event.preventDefault()
      deps.zoomToScale(1)
      return
    }
    if (event.shiftKey && key === '1' && !mod && !event.altKey) {
      event.preventDefault()
      deps.zoomFitToScreen()
      return
    }
    if (event.shiftKey && (key === 'a' || key === 'A') && !mod && !event.altKey) {
      event.preventDefault()
      deps.triggerCanvasUploadShortcut()
      return
    }

    if (mod && (key === 's' || key === 'S')) {
      event.preventDefault()
      deps.handleSaveCanvas()
      return
    }
    if (mod && (key === 'c' || key === 'C')) {
      event.preventDefault()
      deps.copySelectedNode()
      return
    }
    if (mod && (key === 'v' || key === 'V')) {
      event.preventDefault()
      deps.pasteNode()
      return
    }
    if (mod && event.shiftKey && (key === 'z' || key === 'Z')) {
      event.preventDefault()
      deps.handleRedo()
      return
    }
    if (mod && (key === 'z' || key === 'Z') && !event.shiftKey) {
      event.preventDefault()
      deps.handleUndo()
      return
    }

    if (!mod && !event.altKey && !event.shiftKey) {
      if (key === ']') {
        event.preventDefault()
        deps.moveNodeLayer('front')
        return
      }
      if (key === '[') {
        event.preventDefault()
        deps.moveNodeLayer('back')
        return
      }
    }

    if (mod && key === ']') {
      event.preventDefault()
      deps.moveNodeLayer('forward')
      return
    }
    if (mod && key === '[') {
      event.preventDefault()
      deps.moveNodeLayer('backward')
      return
    }

    if (key === 'Alt' && !event.repeat) {
      const node = deps.getSelectedNode()
      if (!node) return
      const data = node.getData() as CanvasNodeData
      if (data.kind !== 'image') return
      if (altVoiceTimer.value) clearTimeout(altVoiceTimer.value)
      altVoiceTimer.value = setTimeout(() => {
        deps.openImageDialogue(node.id)
        altVoiceTimer.value = null
      }, 420)
      return
    }

    if (key !== 'Delete' && key !== 'Backspace') return
    if (deps.hasSelectedEdge()) {
      event.preventDefault()
      deps.removeSelectedEdge()
      return
    }
    if (!deps.hasSelectedNodes()) return
    event.preventDefault()
    deps.removeSelectedNodes()
  }

  function handleKeyup(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) return

    if (event.key === ' ') {
      const heldMs = Date.now() - spaceKeyDownAt.value
      endSpacePan()
      if (heldMs < 220 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        deps.openImagePreview()
      }
      event.preventDefault()
      return
    }

    if (event.key === 'Alt' && altVoiceTimer.value) {
      clearTimeout(altVoiceTimer.value)
      altVoiceTimer.value = null
    }
  }

  function bindKeyboard() {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
  }

  function unbindKeyboard() {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
  }

  return {
    altVoiceTimer,
    bindKeyboard,
    unbindKeyboard,
    endSpacePan,
  }
}
