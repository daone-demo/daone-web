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

      <label class="image-grid-split-overlay__field">
        <span class="image-grid-split-overlay__field-icon image-grid-split-overlay__field-icon--row" />
        行
        <input
          v-model.number="localRows"
          class="image-grid-split-overlay__input"
          type="number"
          min="1"
          max="10"
          @mousedown.stop
        />
      </label>

      <label class="image-grid-split-overlay__field">
        <span class="image-grid-split-overlay__field-icon image-grid-split-overlay__field-icon--col" />
        列
        <input
          v-model.number="localCols"
          class="image-grid-split-overlay__input"
          type="number"
          min="1"
          max="10"
          @mousedown.stop
        />
      </label>

      <button
        type="button"
        class="image-grid-split-overlay__btn image-grid-split-overlay__btn--done"
        @click="handleComplete"
      >
        <span class="image-grid-split-overlay__icon image-grid-split-overlay__icon--check" />
        完成
      </button>
    </div>

    <div class="image-grid-split-overlay__stage">
      <div ref="wrapRef" class="image-grid-split-overlay__image-wrap">
        <img :src="imageUrl" class="image-grid-split-overlay__image" draggable="false" alt="" />

        <!-- 单元格描边（按拖拽比例） -->
        <div class="image-grid-split-overlay__cells" aria-hidden="true">
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="image-grid-split-overlay__cell"
            :style="cell.style"
          />
        </div>

        <!-- 可拖拽竖线 -->
        <div
          v-for="(stop, index) in colStops"
          :key="`col-${index}`"
          class="image-grid-split-overlay__line image-grid-split-overlay__line--col"
          :class="{ 'image-grid-split-overlay__line--active': dragState?.axis === 'col' && dragState.index === index }"
          :style="{ left: `${stop * 100}%` }"
          @mousedown.stop.prevent="startDrag('col', index, $event)"
        />

        <!-- 可拖拽横线 -->
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

const MIN_GAP = 0.04

const wrapRef = ref<HTMLElement | null>(null)
const localRows = ref(2)
const localCols = ref(2)
const rowStops = ref<number[]>([])
const colStops = ref<number[]>([])

type DragState = {
  axis: 'row' | 'col'
  index: number
}
const dragState = ref<DragState | null>(null)

const safeRows = computed(() => Math.max(1, Math.min(10, Math.floor(Number(localRows.value) || 1))))
const safeCols = computed(() => Math.max(1, Math.min(10, Math.floor(Number(localCols.value) || 1))))

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
    localRows.value = Math.max(1, Math.min(10, rows || 2))
    localCols.value = Math.max(1, Math.min(10, cols || 2))
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
  localRows.value = 2
  localCols.value = 2
  rowStops.value = createEqualStops(2)
  colStops.value = createEqualStops(2)
}

function handleComplete() {
  emit('complete', {
    rows: safeRows.value,
    cols: safeCols.value,
    rowStops: [...rowStops.value],
    colStops: [...colStops.value],
  })
}

onBeforeUnmount(() => {
  dragState.value = null
})
</script>

<style scoped lang="scss">
.image-grid-split-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}

.image-grid-split-overlay__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: center;
  min-height: 44px;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  flex-shrink: 0;
  white-space: nowrap;
}

.image-grid-split-overlay__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f3f4f6;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  &--done {
    background: #111827;
    color: #fff;

    &:hover:not(:disabled) {
      background: #1f2937;
    }
  }
}

.image-grid-split-overlay__field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 0 10px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
  font-size: 13px;
}

.image-grid-split-overlay__input {
  width: 44px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  text-align: center;
  outline: none;

  &:focus {
    border-color: #6366f1;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
  }
}

.image-grid-split-overlay__icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  position: relative;

  &--close::before,
  &--close::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 1px;
    width: 1.5px;
    height: 12px;
    background: currentColor;
  }

  &--close::before {
    transform: rotate(45deg);
  }

  &--close::after {
    transform: rotate(-45deg);
  }

  &--reset {
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;

    &::after {
      content: '';
      position: absolute;
      top: -2px;
      right: -1px;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 5px solid currentColor;
      transform: rotate(45deg);
    }
  }

  &--check::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 6px;
    width: 8px;
    height: 4px;
    border-left: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
  }
}

.image-grid-split-overlay__field-icon {
  width: 14px;
  height: 14px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.8;
  position: relative;

  &--row::before {
    content: '';
    position: absolute;
    left: 1px;
    right: 1px;
    top: 50%;
    height: 1px;
    background: currentColor;
  }

  &--col::before {
    content: '';
    position: absolute;
    top: 1px;
    bottom: 1px;
    left: 50%;
    width: 1px;
    background: currentColor;
  }
}

.image-grid-split-overlay__stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-grid-split-overlay__image-wrap {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.14);
  background: #f3f4f6;
  touch-action: none;
  user-select: none;
}

.image-grid-split-overlay__image {
  display: block;
  max-width: min(100%, 420px);
  max-height: min(68vh, 640px);
  width: auto;
  height: auto;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}

.image-grid-split-overlay__cells {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.image-grid-split-overlay__cell {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(99, 102, 241, 0.55);
}

.image-grid-split-overlay__line {
  position: absolute;
  z-index: 2;
  background: #6366f1;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55);

  &--col {
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    cursor: col-resize;
    pointer-events: auto;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -6px;
      width: 14px;
    }
  }

  &--row {
    left: 0;
    right: 0;
    height: 2px;
    margin-top: -1px;
    cursor: row-resize;
    pointer-events: auto;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: -6px;
      height: 14px;
    }
  }

  &--active {
    background: #4f46e5;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35);
  }
}
</style>
