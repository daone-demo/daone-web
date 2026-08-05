<template>
  <div
    class="canvas__group-overlay"
    :class="{
      'canvas__group-overlay--light': isLight,
      'canvas__group-overlay--active': active,
    }"
    :style="overlayStyle"
  >
    <div
      class="canvas__group-label"
      title="点击选中整组，拖动可移动"
      @mousedown.stop="onLabelMouseDown"
    >
      分组 {{ nodeCount }} 个节点
    </div>
    <div class="canvas__group-frame">
      <span
        v-for="handle in handles"
        :key="handle"
        class="canvas__group-handle"
        :class="`canvas__group-handle--${handle}`"
        :data-handle="handle"
        @mousedown.stop="onHandleMouseDown($event, handle)"
      />
    </div>
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
  isLight?: boolean
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

function onLabelMouseDown(event: MouseEvent) {
  if (event.button !== 0) return
  emit('select-group', props.groupId)
  emit('drag-start', { event, groupId: props.groupId })
}

function onHandleMouseDown(event: MouseEvent, handle: GroupResizeHandle) {
  if (event.button !== 0) return
  emit('resize-start', { event, handle, groupId: props.groupId })
}
</script>
