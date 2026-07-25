<template>
  <div class="image-edit-text-panel" @mousedown.stop>
    <div class="image-edit-text-panel__head">
      <h3 class="image-edit-text-panel__title">编辑文字</h3>
      <button type="button" class="image-edit-text-panel__close" title="关闭" @click="emit('cancel')">
        ×
      </button>
    </div>

    <div class="image-edit-text-panel__body">
      <div v-if="recognizing" class="image-edit-text-panel__loading">
        <span class="image-edit-text-panel__spinner" aria-hidden="true" />
        正在识别文字...
      </div>

      <div v-else-if="!visibleEntries.length" class="image-edit-text-panel__empty">
        未识别到可编辑文字，可点击下方 + 手动添加
      </div>

      <div v-else class="image-edit-text-panel__list">
        <div
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="image-edit-text-panel__item"
        >
          <input
            v-model="entry.text"
            class="image-edit-text-panel__input"
            type="text"
            :placeholder="entry.isNew ? '输入新增文字' : '编辑文字'"
            @mousedown.stop
          />
          <button
            type="button"
            class="image-edit-text-panel__delete"
            title="删除"
            @click="removeEntry(entry.id)"
          >
            <span class="image-edit-text-panel__delete-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <div class="image-edit-text-panel__footer">
      <button
        type="button"
        class="image-edit-text-panel__add"
        title="新增文字"
        :disabled="recognizing"
        @click="addEntry"
      >
        +
      </button>
      <button
        type="button"
        class="image-edit-text-panel__apply"
        :disabled="recognizing"
        @click="handleApply"
      >
        应用修改
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  collectImageEditTextChanges,
  createEmptyEditTextEntry,
  type ImageEditTextEntry,
} from './editTextUtils'

const props = defineProps<{
  entries: ImageEditTextEntry[]
  recognizing?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  apply: [changes: ReturnType<typeof collectImageEditTextChanges>]
  'update:entries': [entries: ImageEditTextEntry[]]
}>()

const localEntries = ref<ImageEditTextEntry[]>([])
const removedIds = ref(new Set<string>())

const visibleEntries = computed(() =>
  localEntries.value.filter((entry) => !removedIds.value.has(entry.id)),
)

watch(
  () => props.entries,
  (entries) => {
    localEntries.value = entries.map((entry) => ({ ...entry }))
    removedIds.value = new Set()
  },
  { immediate: true, deep: true },
)

function syncEntries() {
  emit('update:entries', localEntries.value.map((entry) => ({ ...entry })))
}

function addEntry() {
  localEntries.value = [...localEntries.value, createEmptyEditTextEntry()]
  syncEntries()
}

function removeEntry(id: string) {
  const entry = localEntries.value.find((item) => item.id === id)
  if (!entry) return
  if (entry.isNew) {
    localEntries.value = localEntries.value.filter((item) => item.id !== id)
  } else {
    removedIds.value = new Set([...removedIds.value, id])
  }
  syncEntries()
}

function handleApply() {
  const changes = collectImageEditTextChanges(localEntries.value, removedIds.value)
  if (!changes.length) {
    message.warning('请修改文字后再应用')
    return
  }
  emit('apply', changes)
}
</script>

<style scoped lang="scss">
.image-edit-text-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 280px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.image-edit-text-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  flex-shrink: 0;
}

.image-edit-text-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.image-edit-text-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
    color: #6b7280;
  }
}

.image-edit-text-panel__body {
  flex: 1;
  min-height: 0;
  padding: 0 18px;
  overflow: auto;
}

.image-edit-text-panel__loading,
.image-edit-text-panel__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
}

.image-edit-text-panel__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #dbeafe;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: image-edit-text-spin 0.8s linear infinite;
}

@keyframes image-edit-text-spin {
  to {
    transform: rotate(360deg);
  }
}

.image-edit-text-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 12px;
}

.image-edit-text-panel__item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.image-edit-text-panel__input {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: #93c5fd;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }
}

.image-edit-text-panel__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #fef2f2;
  }
}

.image-edit-text-panel__delete-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background: #ef4444;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='black' d='M3.5 4.2h9M6.2 4.2V3.1a.8.8 0 0 1 .8-.8h2a.8.8 0 0 1 .8.8v1.1M12.2 4.2v8.4a1.1 1.1 0 0 1-1.1 1.1H4.9a1.1 1.1 0 0 1-1.1-1.1V4.2M6.5 7.1v3.4M9.5 7.1v3.4' stroke='black' stroke-width='1.1' stroke-linecap='round'/%3E%3C/svg%3E");
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
}

.image-edit-text-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px 16px;
  flex-shrink: 0;
}

.image-edit-text-panel__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #f9fafb;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.image-edit-text-panel__apply {
  min-width: 108px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: #111827;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #1f2937;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}
</style>
