<template>
  <div
    class="canvas__group-overlay"
    :class="{ 'canvas__group-overlay--active': active }"
    :style="overlayStyle"
  >
    <input
      v-if="editing"
      ref="inputRef"
      v-model="draftTitle"
      class="canvas__group-label-input"
      type="text"
      maxlength="40"
      @mousedown.stop
      @click.stop
      @keydown.enter.prevent="commitEditing"
      @keydown.esc.prevent="cancelEditing"
      @blur="commitEditing"
    />
    <div
      v-else
      class="canvas__group-label"
      title="双击修改标题；拖动标题或组内空白区域可移动整组"
      @mousedown.stop="onLabelMouseDown"
      @dblclick.stop="startEditing"
    >
      {{ title }}
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
import { computed, nextTick, ref, watch } from 'vue'
import type { GroupResizeHandle } from '../nodeGroup'

const props = defineProps<{
  groupId: string
  box: { left: number; top: number; width: number; height: number }
  title: string
  active?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [payload: { event: MouseEvent; groupId: string }]
  'resize-start': [payload: { event: MouseEvent; handle: GroupResizeHandle; groupId: string }]
  'select-group': [groupId: string]
  'title-change': [payload: { groupId: string; title: string }]
}>()

const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

const editing = ref(false)
const draftTitle = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const overlayStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
}))

watch(
  () => props.title,
  (value) => {
    if (!editing.value) draftTitle.value = value
  },
)

function onLabelMouseDown(event: MouseEvent) {
  if (event.button !== 0 || editing.value) return
  emit('select-group', props.groupId)
  emit('drag-start', { event, groupId: props.groupId })
}

function onHandleMouseDown(event: MouseEvent, handle: GroupResizeHandle) {
  if (event.button !== 0) return
  emit('select-group', props.groupId)
  emit('resize-start', { event, handle, groupId: props.groupId })
}

async function startEditing() {
  emit('select-group', props.groupId)
  draftTitle.value = props.title
  editing.value = true
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
}

function commitEditing() {
  if (!editing.value) return
  editing.value = false
  const next = draftTitle.value.trim()
  if (next === props.title.trim()) return
  emit('title-change', { groupId: props.groupId, title: next })
}

function cancelEditing() {
  editing.value = false
  draftTitle.value = props.title
}
</script>
