<template>
  <div class="tft" :class="{ 'tft--light': isLightTheme }" @mousedown.stop.prevent>
    <!-- 颜色 -->
    <div class="tft__group tft__color">
      <button
        type="button"
        class="tft__swatch"
        title="文字颜色"
        :style="{ background: color }"
        @click="toggle('color')"
      />
      <button
        type="button"
        class="tft__swatch tft__swatch--none"
        title="清除颜色"
        @click="emitCmd('clear-color')"
      />
      <div v-if="open === 'color'" class="tft__pop tft__pop--color">
        <button
          v-for="c in TEXT_COLOR_SWATCHES"
          :key="c"
          type="button"
          class="tft__dot"
          :class="{ 'tft__dot--light': c.toLowerCase() === '#ffffff' }"
          :style="{ background: c }"
          @click="pickColor(c)"
        />
      </div>
    </div>

    <span class="tft__divider" />

    <!-- 字体 -->
    <div class="tft__group">
      <button type="button" class="tft__select" @click="toggle('family')">
        <span class="tft__select-text">{{ familyLabel }}</span>
        <span class="tft__chev" v-html="chevSvg" />
      </button>
      <div v-if="open === 'family'" class="tft__pop">
        <button
          v-for="f in TEXT_FONT_FAMILIES"
          :key="f.value"
          type="button"
          class="tft__item"
          :class="{ 'tft__item--active': f.label === familyLabel }"
          :style="{ fontFamily: f.value }"
          @click="pickFamily(f)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- 字重 -->
    <div class="tft__group">
      <button type="button" class="tft__select" @click="toggle('weight')">
        <span class="tft__select-text">{{ weightLabel }}</span>
        <span class="tft__chev" v-html="chevSvg" />
      </button>
      <div v-if="open === 'weight'" class="tft__pop">
        <button
          v-for="w in TEXT_FONT_WEIGHTS"
          :key="w.value"
          type="button"
          class="tft__item"
          :class="{ 'tft__item--active': w.label === weightLabel }"
          :style="{ fontWeight: w.value }"
          @click="pickWeight(w)"
        >
          {{ w.label }}
        </button>
      </div>
    </div>

    <span class="tft__divider" />

    <!-- 加粗 / 斜体 -->
    <div class="tft__bi">
      <button
        type="button"
        class="tft__btn"
        :class="{ 'tft__btn--on': boldActive }"
        title="加粗"
        @click="toggleMark('bold')"
      >
        <b>B</b>
      </button>
      <button
        type="button"
        class="tft__btn"
        :class="{ 'tft__btn--on': italicActive }"
        title="斜体"
        @click="toggleMark('italic')"
      >
        <i>I</i>
      </button>
    </div>

    <span class="tft__divider" />

    <!-- 字号 -->
    <div class="tft__group">
      <button type="button" class="tft__select tft__select--sm" @click="toggle('size')">
        <span class="tft__select-text">{{ size }}</span>
        <span class="tft__chev" v-html="chevSvg" />
      </button>
      <div v-if="open === 'size'" class="tft__pop tft__pop--scroll">
        <button
          v-for="s in TEXT_FONT_SIZES"
          :key="s"
          type="button"
          class="tft__item"
          :class="{ 'tft__item--active': s === size }"
          @click="pickSize(s)"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <!-- 对齐 -->
    <div class="tft__group">
      <button type="button" class="tft__btn" title="对齐" @click="toggle('align')">
        <span class="tft__ico" v-html="alignSvg(align)" />
        <span class="tft__chev" v-html="chevSvg" />
      </button>
      <div v-if="open === 'align'" class="tft__pop tft__pop--row">
        <button
          v-for="a in TEXT_ALIGN_OPTIONS"
          :key="a.key"
          type="button"
          class="tft__btn"
          :class="{ 'tft__btn--on': a.key === align }"
          :title="a.title"
          @click="pickAlign(a.key)"
        >
          <span class="tft__ico" v-html="alignSvg(a.key)" />
        </button>
      </div>
    </div>

    <!-- 行距 / 调节 -->
    <div class="tft__group">
      <button type="button" class="tft__btn" title="行距" @click="toggle('lh')">
        <span class="tft__ico" v-html="slidersSvg" />
      </button>
      <div v-if="open === 'lh'" class="tft__pop">
        <button
          v-for="lh in TEXT_LINE_HEIGHTS"
          :key="lh"
          type="button"
          class="tft__item"
          :class="{ 'tft__item--active': lh === lineHeight }"
          @click="pickLineHeight(lh)"
        >
          行距 {{ lh }}
        </button>
      </div>
    </div>

    <span class="tft__divider" />

    <!-- 下载 / 删除 -->
    <button type="button" class="tft__btn" title="下载文本" @click="emitCmd('download')">
      <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="tft__btn tft__btn--danger"
      title="删除节点"
      @click="emitCmd('delete')"
    >
      <span class="canvas__node-toolbar-icon" data-icon="delete" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  TEXT_ALIGN_OPTIONS,
  TEXT_COLOR_SWATCHES,
  TEXT_FONT_FAMILIES,
  TEXT_FONT_SIZES,
  TEXT_FONT_WEIGHTS,
  TEXT_LINE_HEIGHTS,
  type TextFormatCommand,
} from './constants'
import { useCanvasBgTheme } from './useCanvasBgTheme'

const { isLightTheme } = useCanvasBgTheme()

const emit = defineEmits<{
  command: [cmd: TextFormatCommand, value?: string]
}>()

type MenuKey = 'color' | 'family' | 'weight' | 'size' | 'align' | 'lh' | null
const open = ref<MenuKey>(null)

const color = ref('#111111')
const familyLabel = ref('Inter')
const weightLabel = ref('Regular')
const size = ref(16)
const align = ref('left')
const lineHeight = ref('1.5')
const boldActive = ref(false)
const italicActive = ref(false)

const chevSvg =
  '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const slidersSvg =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 5h10M3 11h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="6" cy="5" r="1.7" fill="currentColor"/><circle cx="10" cy="11" r="1.7" fill="currentColor"/></svg>'

function alignSvg(key: string) {
  const map: Record<string, string[]> = {
    left: ['M2 4h12', 'M2 8h8', 'M2 12h11'],
    center: ['M2 4h12', 'M4 8h8', 'M3 12h10'],
    right: ['M2 4h12', 'M6 8h8', 'M2 12h12'],
    justify: ['M2 4h12', 'M2 8h12', 'M2 12h12'],
  }
  const lines = map[key] ?? map.left
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">${lines
    .map(
      (d) =>
        `<path d="${d}" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
    )
    .join('')}</svg>`
}

function toggle(key: Exclude<MenuKey, null>) {
  open.value = open.value === key ? null : key
}

function emitCmd(cmd: TextFormatCommand, value?: string) {
  emit('command', cmd, value)
}

function pickColor(c: string) {
  color.value = c
  emitCmd('color', c)
  open.value = null
}

function pickFamily(f: { label: string; value: string }) {
  familyLabel.value = f.label
  emitCmd('fontFamily', f.value)
  open.value = null
}

function pickWeight(w: { label: string; value: string }) {
  weightLabel.value = w.label
  emitCmd('fontWeight', w.value)
  open.value = null
}

function pickSize(s: number) {
  size.value = s
  emitCmd('fontSize', String(s))
  open.value = null
}

function pickAlign(key: string) {
  align.value = key
  emitCmd('align', key)
  open.value = null
}

function pickLineHeight(lh: string) {
  lineHeight.value = lh
  emitCmd('lineHeight', lh)
  open.value = null
}

function toggleMark(cmd: 'bold' | 'italic') {
  if (cmd === 'bold') boldActive.value = !boldActive.value
  else italicActive.value = !italicActive.value
  emitCmd(cmd)
}

function onDocMouseDown() {
  open.value = null
}

onMounted(() => document.addEventListener('mousedown', onDocMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown))
</script>

<style scoped lang="scss">
.tft {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #ebedf0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
  color: #374151;
}

.tft__group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.tft__color {
  gap: 4px;
}

.tft__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: #e5e7eb;
}

.tft__swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 50%;
  cursor: pointer;
}

.tft__swatch--none {
  position: relative;
  background: #fff;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    width: 1.5px;
    height: 140%;
    background: #ef4444;
    transform: translateX(-50%) rotate(45deg);
    transform-origin: center;
  }
}

.tft__select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.tft__select--sm {
  min-width: 44px;
  justify-content: space-between;
}

.tft__select-text {
  max-width: 120px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tft__chev {
  display: inline-flex;
  color: #9ca3af;
}

.tft__bi {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: #f3f4f6;
}

.tft__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;

  b,
  i {
    font-size: 14px;
  }

  &:hover {
    background: #eceef1;
  }

  &--on {
    background: #fff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  }

  &--danger {
    color: #ef4444;

    &:hover {
      background: rgba(239, 68, 68, 0.12);
    }

    :deep(.canvas__node-toolbar-icon[data-icon='delete']) {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23ef4444' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M3 4.5h10M6.5 4.5V3.5h3v1M5 4.5l.6 8h4.8l.6-8M6.8 6.5v4M9.2 6.5v4'/%3E%3C/svg%3E");
    }
  }
}

.tft__ico {
  display: inline-flex;
  align-items: center;
}

.tft__pop {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  z-index: 40;
  min-width: 132px;
  padding: 6px;
  border: 1px solid #ebedf0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.tft__pop--scroll {
  max-height: 240px;
  overflow-y: auto;
}

.tft__pop--row {
  display: flex;
  gap: 2px;
  min-width: auto;
}

.tft__pop--color {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  min-width: auto;
}

.tft__dot {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 50%;
  cursor: pointer;

  &--light {
    border-color: #d1d5db;
  }
}

.tft__item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }

  &--active {
    background: #eef2ff;
    color: #4f46e5;
  }
}

/* 深色画布下的浮层（保持工具栏白底，仅微调阴影） */
.tft--light {
  border-color: #ebedf0;
}
</style>
