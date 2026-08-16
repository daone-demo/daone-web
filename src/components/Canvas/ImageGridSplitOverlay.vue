<template>
  <div class="image-grid-split-overlay" @mousedown.stop>
    <div class="image-grid-split-overlay__toolbar">
      <button type="button" class="image-grid-split-overlay__btn" @click="emit('cancel')">
        <span class="image-grid-split-overlay__icon image-grid-split-overlay__icon--close" />
        取消
      </button>

      <button type="button" class="image-grid-split-overlay__btn" @click="resetGrid">
        <span class="image-grid-split-overlay__icon image-grid-split-overlay__icon--reset" />
        重置
      </button>

      <div
        class="image-grid-split-overlay__preset-dropdown"
        :class="{ 'image-grid-split-overlay__preset-dropdown--open': presetMenuOpen }"
        @mousedown.stop
      >
        <button
          type="button"
          class="image-grid-split-overlay__preset-trigger"
          aria-haspopup="listbox"
          :aria-expanded="presetMenuOpen"
          @click.stop="presetMenuOpen = !presetMenuOpen"
        >
          <span>{{ activePresetLabel }}</span>
          <span class="image-grid-split-overlay__preset-caret" aria-hidden="true" />
        </button>
        <div
          v-if="presetMenuOpen"
          class="image-grid-split-overlay__preset-menu"
          role="listbox"
          @mousedown.stop
          @click.stop
          @wheel.stop
        >
          <button
            v-for="item in GRID_PRESET_OPTIONS"
            :key="item.key"
            type="button"
            class="image-grid-split-overlay__preset-option"
            :class="{ 'image-grid-split-overlay__preset-option--active': activePreset === item.key }"
            role="option"
            :aria-selected="activePreset === item.key"
            @click="selectPreset(item.key)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="image-grid-split-overlay__btn image-grid-split-overlay__btn--done"
        @click="handleComplete"
      >
        <span class="image-grid-split-overlay__icon image-grid-split-overlay__icon--check" />
        完成
      </button>
    </div>

    <div ref="wrapRef" class="image-grid-split-overlay__image-wrap">
      <div class="image-grid-split-overlay__cells" aria-hidden="true">
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="image-grid-split-overlay__cell"
          :style="cell.style"
        />
      </div>

      <div
        v-for="(stop, index) in colStops"
        :key="`col-${index}`"
        class="image-grid-split-overlay__line image-grid-split-overlay__line--col"
        :class="{ 'image-grid-split-overlay__line--active': dragState?.axis === 'col' && dragState.index === index }"
        :style="{ left: `${stop * 100}%` }"
        @mousedown.stop.prevent="startDrag('col', index, $event)"
      />

      <div
        v-for="(stop, index) in rowStops"
        :key="`row-${index}`"
        class="image-grid-split-overlay__line image-grid-split-overlay__line--row"
        :class="{ 'image-grid-split-overlay__line--active': dragState?.axis === 'row' && dragState.index === index }"
        :style="{ top: `${stop * 100}%` }"
        @mousedown.stop.prevent="startDrag('row', index, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/** 样式：styles/canvas-image-grid-split.scss（随 Canvas 主包加载） */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createEqualStops } from './gridSplitUtils'

const props = defineProps<{
  imageUrl: string
  naturalWidth: number
  naturalHeight: number
  rows: number
  cols: number
}>()

const emit = defineEmits<{
  cancel: []
  complete: [payload: {
    rows: number
    cols: number
    rowStops: number[]
    colStops: number[]
  }]
}>()

const GRID_PRESET_OPTIONS = [
  { key: '4', label: '4宫格', rows: 2, cols: 2 },
  { key: '9', label: '9宫格', rows: 3, cols: 3 },
] as const

type GridPreset = (typeof GRID_PRESET_OPTIONS)[number]['key']

const MIN_GAP = 0.04

const wrapRef = ref<HTMLElement | null>(null)
const localRows = ref(2)
const localCols = ref(2)
const activePreset = ref<GridPreset>('4')
const presetMenuOpen = ref(false)
const rowStops = ref<number[]>([])
const colStops = ref<number[]>([])

type DragState = {
  axis: 'row' | 'col'
  index: number
}
const dragState = ref<DragState | null>(null)

const safeRows = computed(() => Math.max(1, Math.floor(Number(localRows.value) || 1)))
const safeCols = computed(() => Math.max(1, Math.floor(Number(localCols.value) || 1)))

const activePresetLabel = computed(
  () => GRID_PRESET_OPTIONS.find((item) => item.key === activePreset.value)?.label ?? '4宫格',
)

function syncActivePreset() {
  activePreset.value = safeRows.value === 3 && safeCols.value === 3 ? '9' : '4'
}

function applyPreset(preset: GridPreset) {
  const option = GRID_PRESET_OPTIONS.find((item) => item.key === preset)
  if (!option) return
  activePreset.value = preset
  localRows.value = option.rows
  localCols.value = option.cols
  rowStops.value = createEqualStops(option.rows)
  colStops.value = createEqualStops(option.cols)
}

function selectPreset(preset: GridPreset) {
  applyPreset(preset)
  presetMenuOpen.value = false
}

function syncStopsByCount(axis: 'row' | 'col', count: number) {
  const target = Math.max(0, count - 1)
  const current = axis === 'row' ? rowStops.value : colStops.value
  if (current.length === target) return
  const next = createEqualStops(count)
  if (axis === 'row') rowStops.value = next
  else colStops.value = next
}

watch(
  () => [props.rows, props.cols] as const,
  ([rows, cols]) => {
    const nextRows = Math.max(1, rows || 2)
    const nextCols = Math.max(1, cols || 2)
    localRows.value = nextRows
    localCols.value = nextCols
    syncActivePreset()
    rowStops.value = createEqualStops(localRows.value)
    colStops.value = createEqualStops(localCols.value)
  },
  { immediate: true },
)

watch(safeRows, (rows) => syncStopsByCount('row', rows))
watch(safeCols, (cols) => syncStopsByCount('col', cols))

const edgeX = computed(() => [0, ...colStops.value, 1])
const edgeY = computed(() => [0, ...rowStops.value, 1])

const cells = computed(() => {
  const list: Array<{ key: string; style: Record<string, string> }> = []
  for (let r = 0; r < safeRows.value; r += 1) {
    for (let c = 0; c < safeCols.value; c += 1) {
      const left = edgeX.value[c]
      const right = edgeX.value[c + 1]
      const top = edgeY.value[r]
      const bottom = edgeY.value[r + 1]
      list.push({
        key: `${r + 1}-${c + 1}`,
        style: {
          left: `${left * 100}%`,
          top: `${top * 100}%`,
          width: `${(right - left) * 100}%`,
          height: `${(bottom - top) * 100}%`,
        },
      })
    }
  }
  return list
})

function clampStop(axis: 'row' | 'col', index: number, value: number) {
  const stops = axis === 'row' ? rowStops.value : colStops.value
  const prev = index === 0 ? 0 : stops[index - 1]
  const next = index === stops.length - 1 ? 1 : stops[index + 1]
  const min = prev + MIN_GAP
  const max = next - MIN_GAP
  if (min >= max) return (prev + next) / 2
  return Math.min(max, Math.max(min, value))
}

function startDrag(axis: 'row' | 'col', index: number, event: MouseEvent) {
  const wrap = wrapRef.value
  if (!wrap) return
  dragState.value = { axis, index }

  const onMove = (e: MouseEvent) => {
    const rect = wrap.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const ratio =
      axis === 'col'
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height
    const next = clampStop(axis, index, ratio)
    if (axis === 'col') {
      const copy = [...colStops.value]
      copy[index] = next
      colStops.value = copy
    } else {
      const copy = [...rowStops.value]
      copy[index] = next
      rowStops.value = copy
    }
  }

  const onUp = () => {
    dragState.value = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  onMove(event)
}

function resetGrid() {
  applyPreset('4')
  presetMenuOpen.value = false
}

function handleComplete() {
  emit('complete', {
    rows: safeRows.value,
    cols: safeCols.value,
    rowStops: [...rowStops.value],
    colStops: [...colStops.value],
  })
}

function closePresetMenuOnOutside(event: MouseEvent) {
  if (!presetMenuOpen.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.image-grid-split-overlay__preset-dropdown')) return
  presetMenuOpen.value = false
}

onMounted(() => {
  window.addEventListener('mousedown', closePresetMenuOnOutside, true)
})

onBeforeUnmount(() => {
  dragState.value = null
  presetMenuOpen.value = false
  window.removeEventListener('mousedown', closePresetMenuOnOutside, true)
})
</script>
