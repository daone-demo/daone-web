import type { CanvasAssetDragPayload, CanvasElementGroupDragPayload } from './constants'

let pending: CanvasAssetDragPayload | null = null
let pendingElementGroup: CanvasElementGroupDragPayload | null = null
let active = false
let handledDrop = false
let dropHandler: ((event: DragEvent) => void) | null = null

function onDocumentDragOver(event: DragEvent) {
  if (!active) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onDocumentDrop(event: DragEvent) {
  if (!active || !dropHandler || handledDrop) return
  handledDrop = true
  event.preventDefault()
  event.stopPropagation()
  dropHandler(event)
  endCanvasAssetDragSession()
}

function bindDocumentDragListeners() {
  document.addEventListener('dragover', onDocumentDragOver, true)
  document.addEventListener('drop', onDocumentDrop, true)
}

function unbindDocumentDragListeners() {
  document.removeEventListener('dragover', onDocumentDragOver, true)
  document.removeEventListener('drop', onDocumentDrop, true)
}

export function setCanvasAssetDropHandler(handler: ((event: DragEvent) => void) | null) {
  dropHandler = handler
}

export function startCanvasAssetDrag(payload: CanvasAssetDragPayload) {
  pending = payload
  pendingElementGroup = null
  active = true
  handledDrop = false
  bindDocumentDragListeners()
}

export function startCanvasElementGroupDrag(payload: CanvasElementGroupDragPayload) {
  pendingElementGroup = payload
  pending = null
  active = true
  handledDrop = false
  bindDocumentDragListeners()
}

export function isCanvasAssetDragActive() {
  return active
}

export function wasCanvasAssetDropHandled() {
  return handledDrop
}

export function consumeCanvasAssetDragPayload() {
  const data = pending
  pending = null
  return data
}

export function consumeCanvasElementGroupDragPayload() {
  const data = pendingElementGroup
  pendingElementGroup = null
  return data
}

export function endCanvasAssetDragSession() {
  active = false
  handledDrop = false
  pending = null
  pendingElementGroup = null
  unbindDocumentDragListeners()
}

export function clearCanvasAssetDrag() {
  endCanvasAssetDragSession()
}
