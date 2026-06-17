<template>
  <div
    class="canvas-shortcuts"
    role="dialog"
    aria-labelledby="canvas-shortcuts-title"
    @mousedown.stop
  >
    <button
      type="button"
      class="canvas-shortcuts__close"
      title="关闭"
      aria-label="关闭快捷键说明"
      @click="emit('close')"
    >
      ×
    </button>

    <h2 id="canvas-shortcuts-title" class="canvas-shortcuts__sr-only">画布快捷键</h2>
    <div class="canvas-shortcuts__grid">
      <section
        v-for="group in CANVAS_SHORTCUT_GROUPS"
        :key="group.title"
        class="canvas-shortcuts__col"
      >
        <h3 class="canvas-shortcuts__title">{{ group.title }}</h3>
        <ul class="canvas-shortcuts__list">
          <li
            v-for="item in group.items"
            :key="item.label"
            class="canvas-shortcuts__row"
          >
            <span class="canvas-shortcuts__label">{{ item.label }}</span>
            <span class="canvas-shortcuts__keys">
              <template v-if="item.keys?.length">
                <template v-for="(key, index) in item.keys" :key="`${item.label}-${key}-${index}`">
                  <span v-if="index > 0" class="canvas-shortcuts__plus">+</span>
                  <span v-if="key === '/'" class="canvas-shortcuts__slash">/</span>
                  <kbd v-else class="canvas-shortcuts__kbd">{{ key }}</kbd>
                </template>
              </template>
              <span v-else-if="item.hint" class="canvas-shortcuts__hint">{{ item.hint }}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CANVAS_SHORTCUT_GROUPS } from './canvasShortcuts'

const emit = defineEmits<{
  close: []
}>()
</script>

<style scoped lang="scss">
.canvas-shortcuts {
  position: relative;
  width: 80vw;
  padding: 28px 24px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fafafa;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  color: #1f2937;
  pointer-events: auto;
}

.canvas-shortcuts__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.canvas-shortcuts__close {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
}

.canvas-shortcuts__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px 40px;
}

.canvas-shortcuts__title {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.02em;
}

.canvas-shortcuts__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.canvas-shortcuts__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
  margin-bottom: 4px;
  font-size: 12px;
}

.canvas-shortcuts__label {
  flex-shrink: 0;
  color: #374151;
  white-space: nowrap;
}

.canvas-shortcuts__keys {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  // min-width: 0;
}

.canvas-shortcuts__plus {
  margin: 0 1px;
  font-size: 12px;
  color: #9ca3af;
  user-select: none;
}

.canvas-shortcuts__slash {
  margin: 0 2px;
  font-size: 12px;
  color: #9ca3af;
}

.canvas-shortcuts__kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f3f4f6;
  box-shadow: inset 0 -1px 0 #e5e7eb;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.canvas-shortcuts__hint {
  font-size: 12px;
  color: #6b7280;
  text-align: right;
  line-height: 1.35;
}

@media (max-width: 900px) {
  .canvas-shortcuts__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .canvas-shortcuts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
