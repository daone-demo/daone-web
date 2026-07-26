<template>
  <div
    class="dialogue-workflow-select"
    :class="{ 'dialogue-workflow-select--dark': !light }"
    @mousedown.stop
  >
    <button
      type="button"
      class="dialogue-workflow-select__trigger"
      :class="{ 'dialogue-workflow-select__trigger--active': open }"
      @click="toggle"
    >
      <span class="dialogue-workflow-select__label">{{ displayLabel }}</span>
      <span class="dialogue-workflow-select__arrow" aria-hidden="true" />
    </button>
    <div
      v-if="open"
      class="dialogue-workflow-select__menu"
      @mousedown.stop
      @wheel.stop
    >
      <button
        v-for="item in options"
        :key="item.id"
        type="button"
        class="dialogue-workflow-select__item"
        :class="{ 'dialogue-workflow-select__item--active': item.id === modelValue }"
        @click="select(item.id)"
      >
        {{ item.name }}
      </button>
      <p v-if="!options.length" class="dialogue-workflow-select__empty">暂无工作流</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export type DialogueWorkflowOption = {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options: DialogueWorkflowOption[]
    placeholder?: string
    light?: boolean
  }>(),
  {
    modelValue: undefined,
    placeholder: '选择工作流',
    light: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const open = ref(false)

const displayLabel = computed(() => {
  const selected = props.options.find((item) => item.id === props.modelValue)
  return selected?.name || props.placeholder
})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function select(id: string) {
  emit('update:modelValue', id)
  close()
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.dialogue-workflow-select')) return
  close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
})
</script>

<style scoped lang="scss">
.dialogue-workflow-select {
  position: relative;
  flex-shrink: 0;
}

.dialogue-workflow-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }

  &--active {
    background: #f3f4f6;
    border-color: #d1d5db;
  }
}

.dialogue-workflow-select__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialogue-workflow-select__arrow {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.dialogue-workflow-select__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  min-width: 160px;
  max-width: 280px;
  max-height: min(280px, calc(100vh - 160px));
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dialogue-workflow-select__item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
  }

  &--active {
    color: #2563eb;
  }
}

.dialogue-workflow-select__empty {
  margin: 0;
  padding: 8px 10px;
  color: #9ca3af;
  font-size: 12px;
}

.dialogue-workflow-select--dark {
  .dialogue-workflow-select__trigger {
    border-color: #4b4b55;
    background: #252528;
    color: #d1d5db;

    &:hover {
      background: #2f2f35;
    }

    &--active {
      background: #35353d;
      border-color: #6b7280;
    }
  }

  .dialogue-workflow-select__menu {
    border-color: #4b4b55;
    background: #252528;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .dialogue-workflow-select__item {
    color: #d1d5db;

    &:hover,
    &--active {
      background: #35353d;
    }

    &--active {
      color: #93c5fd;
    }
  }

  .dialogue-workflow-select__empty {
    color: #9ca3af;
  }
}
</style>
