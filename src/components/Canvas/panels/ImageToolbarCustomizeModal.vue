<template>
  <div class="image-toolbar-customize-backdrop" @mousedown.self="emit('cancel')">
    <div class="image-toolbar-customize-modal" @mousedown.stop>
      <header class="image-toolbar-customize-modal__header">
        <div>
          <h2 class="image-toolbar-customize-modal__title">自定义工具栏</h2>
          <p class="image-toolbar-customize-modal__subtitle">
            拖动调整工具顺序，保存后将同步生效。
          </p>
        </div>
        <button
          type="button"
          class="image-toolbar-customize-modal__close"
          aria-label="关闭"
          @click="emit('cancel')"
        >
          ×
        </button>
      </header>

      <div class="image-toolbar-customize-modal__body">
        <section class="image-toolbar-customize-preview">
          <h3 class="image-toolbar-customize-section__title">第一页预览</h3>
          <p class="image-toolbar-customize-section__desc">
            固定包含对话、更多、下载，中间显示排序前 5 个工具。
          </p>

          <div class="image-toolbar-customize-preview__bar canvas__node-toolbar canvas__node-toolbar--image">
            <div class="canvas__node-toolbar-group">
              <button type="button" class="canvas__node-toolbar-btn" disabled>
                <span class="canvas__node-toolbar-icon" data-icon="chat" aria-hidden="true" />
                <span v-if="draft.showToolNames">{{ IMAGE_NODE_TOOLBAR.chat.label }}</span>
              </button>
            </div>
            <span class="canvas__node-toolbar-divider" aria-hidden="true" />
            <div class="canvas__node-toolbar-group">
              <button
                v-for="item in previewPrimaryActions"
                :key="`preview-${item.key}`"
                type="button"
                class="canvas__node-toolbar-btn"
                disabled
              >
                <span
                  v-if="item.icon"
                  class="canvas__node-toolbar-icon"
                  :data-icon="item.icon"
                  aria-hidden="true"
                />
                <span v-if="draft.showToolNames">{{ item.label }}</span>
              </button>
              <button
                v-if="previewOverflowActions.length"
                type="button"
                class="canvas__node-toolbar-btn"
                disabled
              >
                <span
                  class="canvas__node-toolbar-icon"
                  :data-icon="IMAGE_NODE_TOOLBAR.more.icon"
                  aria-hidden="true"
                />
                <span v-if="draft.showToolNames">{{ IMAGE_NODE_TOOLBAR.more.label }}</span>
                <span class="canvas__node-toolbar-more-count">{{ previewOverflowActions.length }}</span>
              </button>
            </div>
            <span class="canvas__node-toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
              disabled
              title="下载1"
            >
              <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
            </button>
          </div>
        </section>

        <section class="image-toolbar-customize-order">
          <div class="image-toolbar-customize-order__header">
            <div>
              <h3 class="image-toolbar-customize-section__title">工具顺序</h3>
              <p class="image-toolbar-customize-section__desc">
                拖动调整顺序，不包含固定的对话按钮。
              </p>
            </div>
            <div class="image-toolbar-customize-order__meta">
              <span>共 {{ draft.orderedItems.length }} 个可排序工具</span>
              <button
                type="button"
                class="image-toolbar-customize-order__reset"
                title="恢复默认顺序"
                @click="resetDraftOrder"
              >
                ↺
              </button>
            </div>
          </div>

          <div class="image-toolbar-customize-order__grid">
            <div
              v-for="(item, index) in draft.orderedItems"
              :key="item.key"
              class="image-toolbar-customize-order__item"
              :class="{ 'image-toolbar-customize-order__item--dragging': draggingIndex === index }"
              draggable="true"
              @dragstart="onDragStart(index, $event)"
              @dragover.prevent="onDragOver(index)"
              @drop.prevent="onDrop(index)"
              @dragend="onDragEnd"
            >
              <span class="image-toolbar-customize-order__handle" aria-hidden="true">⋮⋮</span>
              <span class="image-toolbar-customize-order__index">{{ index + 1 }}</span>
              <span
                v-if="item.icon"
                class="canvas__node-toolbar-icon"
                :data-icon="item.icon"
                aria-hidden="true"
              />
              <span class="image-toolbar-customize-order__label">{{ item.label }}</span>
            </div>
          </div>

          <div
            class="image-toolbar-customize-order__dropzone"
            :class="{ 'image-toolbar-customize-order__dropzone--active': dragOverEnd }"
            @dragover.prevent="dragOverEnd = true"
            @dragleave="dragOverEnd = false"
            @drop.prevent="onDropToEnd"
          >
            拖到这里置于末尾
          </div>
        </section>
      </div>

      <footer class="image-toolbar-customize-modal__footer">
        <label class="image-toolbar-customize-toggle">
          <input v-model="draft.showToolNames" type="checkbox" class="image-toolbar-customize-toggle__input" />
          <span class="image-toolbar-customize-toggle__track" aria-hidden="true">
            <span class="image-toolbar-customize-toggle__thumb" />
          </span>
          <span class="image-toolbar-customize-toggle__text">
            <strong>显示工具名称</strong>
            <small>关闭后工具栏仅显示图标，不显示中文名称。</small>
          </span>
        </label>

        <div class="image-toolbar-customize-modal__actions">
          <button type="button" class="image-toolbar-customize-btn" @click="resetDraftAll">
            重置
          </button>
          <button type="button" class="image-toolbar-customize-btn" @click="emit('cancel')">
            取消
          </button>
          <button type="button" class="image-toolbar-customize-btn image-toolbar-customize-btn--primary" @click="handleSave">
            保存
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  IMAGE_NODE_TOOLBAR,
  type ImageCapability,
  type ImageCapabilityToolbarAction,
} from '../constants'
import {
  buildSortableImageToolbarActions,
  IMAGE_TOOLBAR_PREVIEW_PRIMARY_LIMIT,
  orderImageToolbarActions,
  reorderList,
  splitImageToolbarPreviewActions,
  type ImageToolbarCustomizeSettings,
} from '../imageToolbarCustomize'

const props = defineProps<{
  imageCapabilities: ImageCapability[]
  settings: ImageToolbarCustomizeSettings
}>()

const emit = defineEmits<{
  cancel: []
  save: [settings: ImageToolbarCustomizeSettings]
}>()

const baseActions = computed(() => buildSortableImageToolbarActions(props.imageCapabilities))

const draft = reactive({
  orderedItems: [] as ImageCapabilityToolbarAction[],
  showToolNames: true,
})

const draggingIndex = ref<number | null>(null)
const dragOverEnd = ref(false)

const previewSplit = computed(() =>
  splitImageToolbarPreviewActions(draft.orderedItems, IMAGE_TOOLBAR_PREVIEW_PRIMARY_LIMIT),
)
const previewPrimaryActions = computed(() => previewSplit.value.primaryActions)
const previewOverflowActions = computed(() => previewSplit.value.overflowActions)

function syncDraftFromProps() {
  draft.showToolNames = props.settings.showToolNames !== false
  draft.orderedItems = orderImageToolbarActions(baseActions.value, props.settings)
}

function resetDraftOrder() {
  draft.orderedItems = [...baseActions.value]
}

function resetDraftAll() {
  resetDraftOrder()
  draft.showToolNames = true
}

function onDragStart(index: number, event: DragEvent) {
  draggingIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(index: number) {
  const from = draggingIndex.value
  if (from === null || from === index) return
  draft.orderedItems = reorderList(draft.orderedItems, from, index)
  draggingIndex.value = index
}

function onDrop(index: number) {
  onDragOver(index)
  onDragEnd()
}

function onDropToEnd() {
  const from = draggingIndex.value
  dragOverEnd.value = false
  if (from === null || from < 0 || from >= draft.orderedItems.length) {
    onDragEnd()
    return
  }
  const next = [...draft.orderedItems]
  const [item] = next.splice(from, 1)
  next.push(item)
  draft.orderedItems = next
  onDragEnd()
}

function onDragEnd() {
  draggingIndex.value = null
  dragOverEnd.value = false
}

function handleSave() {
  emit('save', {
    orderedKeys: draft.orderedItems.map((item) => item.key),
    showToolNames: draft.showToolNames,
  })
}

watch(
  () => [props.settings, props.imageCapabilities] as const,
  () => {
    syncDraftFromProps()
  },
  { immediate: true, deep: true },
)
</script>

<style scoped lang="scss">
.image-toolbar-customize-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.42);
}

.image-toolbar-customize-modal {
  width: min(1120px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  background: #f3f4f6;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
  overflow: hidden;
}

.image-toolbar-customize-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px 12px;
}

.image-toolbar-customize-modal__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 600;
  color: #111827;
}

.image-toolbar-customize-modal__subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: #6b7280;
}

.image-toolbar-customize-modal__close {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #6b7280;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: rgba(17, 24, 39, 0.06);
    color: #111827;
  }
}

.image-toolbar-customize-modal__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 8px 28px 20px;
  min-height: 0;
  overflow: auto;
}

.image-toolbar-customize-preview,
.image-toolbar-customize-order {
  min-width: 0;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
}

.image-toolbar-customize-section__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.image-toolbar-customize-section__desc {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #6b7280;
}

.image-toolbar-customize-preview__bar {
  position: static;
  margin-top: 20px;
  transform: none;
  width: fit-content;
  max-width: 100%;
}

.image-toolbar-customize-order__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.image-toolbar-customize-order__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.image-toolbar-customize-order__reset {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font-size: 16px;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}

.image-toolbar-customize-order__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.image-toolbar-customize-order__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  cursor: grab;
  user-select: none;

  &--dragging {
    opacity: 0.55;
  }
}

.image-toolbar-customize-order__handle {
  color: #9ca3af;
  font-size: 12px;
  letter-spacing: -2px;
}

.image-toolbar-customize-order__index {
  width: 18px;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
}

.image-toolbar-customize-order__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 14px;
}

.image-toolbar-customize-order__dropzone {
  margin-top: 12px;
  padding: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;

  &--active {
    border-color: #6b7cff;
    background: rgba(107, 124, 255, 0.06);
    color: #4f46e5;
  }
}

.image-toolbar-customize-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 28px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.image-toolbar-customize-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.image-toolbar-customize-toggle__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.image-toolbar-customize-toggle__track {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: #d1d5db;
  transition: background 0.15s ease;

  .image-toolbar-customize-toggle__input:checked + & {
    background: #111827;
  }
}

.image-toolbar-customize-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;

  .image-toolbar-customize-toggle__input:checked + .image-toolbar-customize-toggle__track & {
    transform: translateX(20px);
  }
}

.image-toolbar-customize-toggle__text {
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }

  small {
    color: #6b7280;
    font-size: 12px;
  }
}

.image-toolbar-customize-modal__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-toolbar-customize-btn {
  min-width: 88px;
  height: 40px;
  padding: 0 18px;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  background: #fff;
  color: #111827;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }

  &--primary {
    border-color: #111827;
    background: #111827;
    color: #fff;

    &:hover {
      background: #000;
    }
  }
}

@media (max-width: 960px) {
  .image-toolbar-customize-modal__body {
    grid-template-columns: 1fr;
  }
}
</style>
