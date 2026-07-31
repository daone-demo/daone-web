import { ref, type Ref, type ShallowRef } from 'vue'
import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'

type ScrollerPanApi = {
  togglePanning: (enabled: boolean) => unknown
}

type ScrollerImplPan = {
  container: HTMLElement
  startPanning: (e: MouseEvent) => void
  stopPanning: (e?: Event) => void
  once: (name: string, handler: (...args: unknown[]) => void) => void
}

type SelectionCancelApi = {
  selectionImpl?: {
    undelegateDocumentEvents: () => void
    hideRubberband: () => void
    container: HTMLElement
  }
}

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
  getScroller: (graph: Graph) => ScrollerPanApi | null
  setRubberbandEnabled: (enabled: boolean) => void
}

/** 长按空白处进入拖拽画布的阈值（毫秒） */
const LONG_PRESS_PAN_MS = 320
/** 长按等待期间移动超过该像素则视为框选，取消长按拖拽 */
const LONG_PRESS_MOVE_CANCEL_PX = 6

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function cancelActiveRubberband(graph: Graph) {
  const selection = graph.getPlugin('selection') as SelectionCancelApi | null
  const impl = selection?.selectionImpl
  if (!impl) return
  impl.undelegateDocumentEvents()
  impl.hideRubberband()
  impl.container.removeAttribute('style')
}

export function useCanvasKeyboard(deps: CanvasKeyboardDeps) {
  const tempPanActive = ref(false)
  const spaceKeyDownAt = ref(0)
  const altVoiceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  let pressStart: { x: number; y: number; event: MouseEvent } | null = null
  let longPressPanActive = false
  /** 左键是否仍按下（用于避免松手后才触发长按进入抓取态） */
  let pressButtonDown = false
  let finishingLongPressPan = false
  let boundGraph: Graph | null = null
  let longPressScrollerImpl: ScrollerImplPan | null = null

  function getScrollerImpl(scroller: ScrollerPanApi | null): ScrollerImplPan | undefined {
    if (!scroller) return undefined
    return (scroller as unknown as { scrollerImpl?: ScrollerImplPan }).scrollerImpl
  }

  function beginTempPan() {
    const scroller = deps.graph.value ? deps.getScroller(deps.graph.value) : null
    if (!scroller || tempPanActive.value) return
    tempPanActive.value = true
    deps.setRubberbandEnabled(false)
    if (!deps.panMode.value) scroller.togglePanning(true)
  }

  function endTempPan() {
    const scroller = deps.graph.value ? deps.getScroller(deps.graph.value) : null
    if (!scroller || !tempPanActive.value) return
    tempPanActive.value = false
    scroller.togglePanning(deps.panMode.value)
    deps.setRubberbandEnabled(!deps.panMode.value)
    // 退出临时拖拽后清掉 panning 标记，恢复默认箭头光标（图一）
    const impl = getScrollerImpl(scroller)
    if (impl && !deps.panMode.value) {
      delete impl.container.dataset.panning
    }
  }

  function clearLongPressTimer() {
    if (!longPressTimer) return
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  function removePressWindowListeners() {
    window.removeEventListener('mousemove', onPressMove)
    window.removeEventListener('mouseup', onPressUp)
  }

  function clearLongPressWatch() {
    clearLongPressTimer()
    pressStart = null
    pressButtonDown = false
    removePressWindowListeners()
  }

  /** 松手后结束长按拖拽，恢复默认光标 */
  function finishLongPressPan() {
    if (finishingLongPressPan) return
    if (!longPressPanActive && !tempPanActive.value) {
      clearLongPressWatch()
      return
    }

    finishingLongPressPan = true
    try {
      const impl = longPressScrollerImpl
      longPressScrollerImpl = null
      longPressPanActive = false

      if (impl) {
        try {
          impl.stopPanning()
        } catch {
          // 已结束或未开始时忽略
        }
        if (!deps.panMode.value) {
          delete impl.container.dataset.panning
        } else {
          impl.container.dataset.panning = 'false'
        }
      }

      endTempPan()
      clearLongPressWatch()
    } finally {
      finishingLongPressPan = false
    }
  }

  function activateLongPressPan(event: MouseEvent) {
    const g = deps.graph.value
    // 定时器触发时若已松手，不进入抓取态，保持默认箭头
    if (!g || longPressPanActive || deps.panMode.value || !pressButtonDown) return

    const scroller = deps.getScroller(g)
    const impl = getScrollerImpl(scroller)
    if (!scroller || !impl) return

    longPressPanActive = true
    longPressScrollerImpl = impl
    clearLongPressTimer()
    cancelActiveRubberband(g)
    beginTempPan()
    impl.container.dataset.panning = 'true'
    impl.startPanning(event)
    impl.once('pan:stop', () => {
      finishLongPressPan()
    })
  }

  function onPressMove(event: MouseEvent) {
    if (!pressStart || longPressPanActive) return
    const dx = event.clientX - pressStart.x
    const dy = event.clientY - pressStart.y
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_CANCEL_PX * LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPressWatch()
    }
  }

  function onPressUp() {
    pressButtonDown = false
    // 长按拖拽中松手：结束临时 panning，恢复图一默认箭头光标
    if (longPressPanActive || tempPanActive.value) {
      finishLongPressPan()
      return
    }
    clearLongPressWatch()
  }

  function onBlankMouseDown({ e }: { e: MouseEvent }) {
    if (e.button !== 0) return
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
    if (deps.panMode.value || tempPanActive.value || longPressPanActive) return

    pressButtonDown = true
    pressStart = { x: e.clientX, y: e.clientY, event: e }
    clearLongPressTimer()
    longPressTimer = setTimeout(() => {
      longPressTimer = null
      if (!pressStart || !pressButtonDown) return
      activateLongPressPan(pressStart.event)
    }, LONG_PRESS_PAN_MS)

    window.addEventListener('mousemove', onPressMove)
    window.addEventListener('mouseup', onPressUp)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return

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

  function bindLongPressPan(g: Graph) {
    boundGraph = g
    g.on('blank:mousedown', onBlankMouseDown)
  }

  function unbindLongPressPan() {
    if (boundGraph) {
      boundGraph.off('blank:mousedown', onBlankMouseDown)
      boundGraph = null
    }
    finishLongPressPan()
  }

  /** 结束临时拖拽态（卸载或强制收尾） */
  function endSpacePan() {
    finishLongPressPan()
  }

  return {
    altVoiceTimer,
    bindKeyboard,
    unbindKeyboard,
    bindLongPressPan,
    unbindLongPressPan,
    endSpacePan,
  }
}
