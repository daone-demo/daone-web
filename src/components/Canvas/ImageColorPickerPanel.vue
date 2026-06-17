<template>
  <div class="image-color-picker">
    <div class="image-color-picker__head">
      <div class="image-color-picker__tools">
        <button type="button" class="image-color-picker__tool" title="重置" @click="resetColor">
          <span class="image-color-picker__tool-icon" data-icon="reset" aria-hidden="true" />
        </button>
        <button type="button" class="image-color-picker__tool" title="撤销" @click="undoColor">
          <span class="image-color-picker__tool-icon" data-icon="undo" aria-hidden="true" />
        </button>
        <button type="button" class="image-color-picker__tool" title="吸管">
          <span class="image-color-picker__tool-icon" data-icon="eyedropper" aria-hidden="true" />
        </button>
      </div>
      <button type="button" class="image-color-picker__close" title="关闭" @click="emit('close')">
        ×
      </button>
    </div>

    <div class="image-color-picker__body">
      <div class="image-color-picker__ring">
        <button
          v-for="(swatch, index) in IMAGE_COLOR_SWATCHES"
          :key="swatch"
          type="button"
          class="image-color-picker__swatch"
          :style="getSwatchStyle(index, swatch)"
          :title="swatch"
          @click="selectSwatch(swatch)"
        />
        <div class="image-color-picker__center" :style="{ backgroundColor: hexValue }" />
      </div>

      <div class="image-color-picker__fine-tune">
        <div
          ref="fieldRef"
          class="image-color-picker__field"
          :style="{ backgroundColor: fieldBaseColor }"
          @mousedown="startFieldDrag"
        >
          <span
            class="image-color-picker__field-handle"
            :style="{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%` }"
          />
        </div>
        <div class="image-color-picker__hue-wrap">
          <input
            v-model.number="hue"
            class="image-color-picker__hue"
            type="range"
            min="0"
            max="360"
            step="1"
          />
        </div>
      </div>
    </div>

    <div class="image-color-picker__footer">
      <div class="image-color-picker__hex-row">
        <label class="image-color-picker__hex">
          <span class="image-color-picker__hex-label">RGB</span>
          <input
            v-model="hexInput"
            class="image-color-picker__hex-input"
            type="text"
            @change="applyHexInput"
          />
        </label>
        <button type="button" class="image-color-picker__btn image-color-picker__btn--ghost" @click="copyColor">
          复制
        </button>
        <button type="button" class="image-color-picker__btn image-color-picker__btn--primary" @click="confirmColor">
          选择
        </button>
      </div>
      <div class="image-color-picker__presets">
        <span class="image-color-picker__presets-label">切换色盘: 默认</span>
        <div class="image-color-picker__preset-icons">
          <button
            v-for="preset in IMAGE_COLOR_PALETTE_PRESETS"
            :key="preset.key"
            type="button"
            class="image-color-picker__preset"
            :class="{ 'image-color-picker__preset--active': activePreset === preset.key }"
            :title="preset.label"
            @click="activePreset = preset.key"
          >
            <span class="image-color-picker__preset-icon" :data-preset="preset.key" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  IMAGE_COLOR_DEFAULT,
  IMAGE_COLOR_PALETTE_PRESETS,
  IMAGE_COLOR_SWATCHES,
} from './constants'

const props = withDefaults(
  defineProps<{
    modelValue?: string
  }>(),
  {
    modelValue: IMAGE_COLOR_DEFAULT,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  close: []
  select: [value: string]
}>()

const fieldRef = ref<HTMLElement | null>(null)
const hue = ref(216)
const saturation = ref(0.78)
const brightness = ref(0.42)
const hexInput = ref('')
const activePreset = ref('default')
const history = ref<string[]>([])
const draggingField = ref(false)

const hexValue = computed(() => hsvToHex(hue.value, saturation.value, brightness.value))
const fieldBaseColor = computed(() => hsvToHex(hue.value, 1, 1))

watch(
  hexValue,
  (value) => {
    hexInput.value = `#${value.replace('#', '').toUpperCase()}`
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return
    const normalized = normalizeHex(value)
    if (normalized.toLowerCase() === hexValue.value.toLowerCase()) return
    applyHex(normalized, false)
  },
  { immediate: true },
)

function normalizeHex(value: string) {
  const raw = value.trim().replace(/^#/, '')
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((char) => char + char)
      .join('')}`
  }
  return `#${raw.slice(0, 6).padEnd(6, '0')}`
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0

  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsv(hex: string) {
  const normalized = normalizeHex(hex).replace('#', '')
  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360

  const s = max === 0 ? 0 : delta / max
  return { h, s, v: max }
}

function applyHex(hex: string, pushHistory = true) {
  const { h, s, v } = hexToHsv(hex)
  if (pushHistory) history.value.push(hexValue.value)
  hue.value = Math.round(h)
  saturation.value = s
  brightness.value = v
}

function getSwatchStyle(index: number, color: string) {
  const angle = (index / IMAGE_COLOR_SWATCHES.length) * 360
  return {
    backgroundColor: color,
    transform: `rotate(${angle}deg) translate(0, -46px) rotate(${-angle}deg)`,
  }
}

function selectSwatch(color: string) {
  history.value.push(hexValue.value)
  applyHex(color, false)
}

function resetColor() {
  history.value.push(hexValue.value)
  applyHex(IMAGE_COLOR_DEFAULT, false)
}

function undoColor() {
  const previous = history.value.pop()
  if (!previous) return
  applyHex(previous, false)
}

function applyHexInput() {
  applyHex(normalizeHex(hexInput.value))
}

function updateFieldFromEvent(event: MouseEvent) {
  const field = fieldRef.value
  if (!field) return
  const rect = field.getBoundingClientRect()
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
  saturation.value = x / rect.width
  brightness.value = 1 - y / rect.height
}

function startFieldDrag(event: MouseEvent) {
  draggingField.value = true
  history.value.push(hexValue.value)
  updateFieldFromEvent(event)
  window.addEventListener('mousemove', onFieldDrag)
  window.addEventListener('mouseup', stopFieldDrag)
}

function onFieldDrag(event: MouseEvent) {
  if (!draggingField.value) return
  updateFieldFromEvent(event)
}

function stopFieldDrag() {
  draggingField.value = false
  window.removeEventListener('mousemove', onFieldDrag)
  window.removeEventListener('mouseup', stopFieldDrag)
}

async function copyColor() {
  try {
    await navigator.clipboard.writeText(hexInput.value)
  } catch {
    // ignore clipboard failures in unsupported environments
  }
}

function confirmColor() {
  emit('update:modelValue', hexValue.value)
  emit('select', hexValue.value)
}

onBeforeUnmount(() => {
  stopFieldDrag()
})
</script>

<style scoped lang="scss">
.image-color-picker {
  width: 420px;
  padding: 14px 16px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}

.image-color-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.image-color-picker__tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.image-color-picker__tool,
.image-color-picker__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.image-color-picker__close {
  font-size: 18px;
  line-height: 1;
}

.image-color-picker__tool-icon {
  width: 16px;
  height: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 16px 16px;

  &[data-icon='reset'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M3.5 8A4.5 4.5 0 1 0 8 3.5V1.5M3.5 4.5 1.5 1.5 1.5 4.5'/%3E%3C/svg%3E");
  }

  &[data-icon='undo'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M4.5 6.5H2.5V2.5M2.5 4.5A5 5 0 1 1 2.5 11.5'/%3E%3C/svg%3E");
  }

  &[data-icon='eyedropper'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m4.5 11.5 1-1 5-5 2 2-5 5-1 1zM10.5 4.5l1-1a1.4 1.4 0 0 1 2 2l-1 1'/%3E%3C/svg%3E");
  }
}

.image-color-picker__body {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
}

.image-color-picker__ring {
  position: relative;
  flex-shrink: 0;
  width: 112px;
  height: 112px;
}

.image-color-picker__swatch {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.18);
  cursor: pointer;
}

.image-color-picker__center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.16);
  transform: translate(-50%, -50%);
}

.image-color-picker__fine-tune {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-color-picker__field {
  position: relative;
  width: 100%;
  height: 148px;
  border-radius: 12px;
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
  overflow: hidden;
}

.image-color-picker__field-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.image-color-picker__hue-wrap {
  padding: 0 2px;
}

.image-color-picker__hue {
  width: 100%;
  height: 12px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 17%,
    #0f0 33%,
    #0ff 50%,
    #00f 67%,
    #f0f 83%,
    #f00 100%
  );
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.2);
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.2);
  }
}

.image-color-picker__hex-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.image-color-picker__hex {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
}

.image-color-picker__hex-label {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 12px;
}

.image-color-picker__hex-input {
  width: 100%;
  border: none;
  background: transparent;
  color: #111827;
  font-size: 13px;
  outline: none;
}

.image-color-picker__btn {
  min-width: 56px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &--ghost {
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #374151;

    &:hover {
      background: #f9fafb;
    }
  }

  &--primary {
    border: 1px solid #111827;
    background: #111827;
    color: #fff;

    &:hover {
      background: #1f2937;
    }
  }
}

.image-color-picker__presets {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.image-color-picker__presets-label {
  color: #9ca3af;
  font-size: 12px;
}

.image-color-picker__preset-icons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.image-color-picker__preset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;

  &--active {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.image-color-picker__preset-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444);

  &[data-preset='warm'] {
    background: conic-gradient(#ef4444, #f97316, #fbbf24, #ef4444);
  }

  &[data-preset='cool'] {
    background: conic-gradient(#3b82f6, #06b6d4, #6366f1, #3b82f6);
  }

  &[data-preset='mono'] {
    background: conic-gradient(#111827, #6b7280, #d1d5db, #111827);
  }
}
</style>
