<template>
  <div
    class="canvas__group-overlay"
    :class="{ 'canvas__group-overlay--active': active }"
    :style="overlayStyle"
  >
    <div
      class="canvas__group-hit"
      title="点击选中整组"
      @mousedown.stop="onHitMouseDown"
    />
    <div
      class="canvas__group-label"
      title="点击选中整组，拖动可移动"
      @mousedown.stop="onLabelMouseDown"
    >
      分组 {{ nodeCount }} 个节点
    </div>
    <span
      v-for="handle in handles"
      v-show="active"
      :key="handle"
      class="canvas__group-handle"
      :class="`canvas__group-handle--${handle}`"
      :data-handle="handle"
      @mousedown.stop="onHandleMouseDown($event, handle)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GroupResizeHandle } from '../nodeGroup'

const props = defineProps<{
  groupId: string
  box: { left: number; top: number; width: number; height: number }
  nodeCount: number
  active?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [payload: { event: MouseEvent; groupId: string }]
  'resize-start': [payload: { event: MouseEvent; handle: GroupResizeHandle; groupId: string }]
  'select-group': [groupId: string]
}>()

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

const overlayStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
}))

function cloneMouseEvent(type: 'mousedown' | 'mouseup' | 'click', source: MouseEvent) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    detail: type === 'click' ? 1 : source.detail,
    clientX: source.clientX,
    clientY: source.clientY,
    screenX: source.screenX,
    screenY: source.screenY,
    button: source.button,
    buttons: source.buttons,
    ctrlKey: source.ctrlKey,
    shiftKey: source.shiftKey,
    altKey: source.altKey,
    metaKey: source.metaKey,
  })
}

function passPointerToGraphTarget(event: MouseEvent, hitEl: HTMLElement): boolean {
  hitEl.style.pointerEvents = 'none'
  const target = document.elementFromPoint(event.clientX, event.clientY)
  hitEl.style.pointerEvents = 'auto'
  if (!target) return false

  const graphTarget = target.closest('.x6-node, .x6-edge')
  if (!graphTarget) return false

  graphTarget.dispatchEvent(cloneMouseEvent('mousedown', event))

  const onMouseUp = (upEvent: MouseEvent) => {
    hitEl.style.pointerEvents = 'none'
    const upTarget = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
    hitEl.style.pointerEvents = 'auto'
    const graphUp = upTarget?.closest('.x6-node, .x6-edge') ?? graphTarget
    graphUp.dispatchEvent(cloneMouseEvent('mouseup', upEvent))
    graphUp.dispatchEvent(cloneMouseEvent('click', upEvent))
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mouseup', onMouseUp)

  return true
}

function onHitMouseDown(event: MouseEvent) {
  if (event.button !== 0) return

  const hitEl = event.currentTarget as HTMLElement
  if (passPointerToGraphTarget(event, hitEl)) return

  emit('select-group', props.groupId)
}

function onLabelMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  emit('select-group', props.groupId)
  emit('drag-start', { event, groupId: props.groupId })
}

function onHandleMouseDown(event: MouseEvent, handle: GroupResizeHandle) {
  if (event.button !== 0) return
  emit('select-group', props.groupId)
  emit('resize-start', { event, handle, groupId: props.groupId })
}
</script>
