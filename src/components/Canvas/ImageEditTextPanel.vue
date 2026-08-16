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
/** 样式：styles/canvas-image-edit-text.scss（随 Canvas 主包加载） */
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
