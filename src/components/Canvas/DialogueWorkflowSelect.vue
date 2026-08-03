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
      :class="{ 'dialogue-workflow-select__menu--grouped': hasGroups }"
      @mousedown.stop
      @wheel.stop
    >
      <template v-if="hasGroups">
        <div class="dialogue-workflow-select__categories">
          <button
            v-for="group in groups"
            :key="group.categoryId"
            type="button"
            class="dialogue-workflow-select__category"
            :class="{ 'dialogue-workflow-select__category--active': group.categoryId === activeCategoryId }"
            @mouseenter="onCategoryHover(group.categoryId)"
            @click="onCategoryHover(group.categoryId)"
          >
            <span class="dialogue-workflow-select__category-label">{{ group.categoryName }}</span>
            <span class="dialogue-workflow-select__category-arrow" aria-hidden="true" />
          </button>
        </div>
        <div class="dialogue-workflow-select__submenu">
          <DigitalHumanPickerPanel
            v-if="showDigitalHumanPicker"
            :light="light"
            @back="closeDigitalHumanPicker"
            @select="onDigitalHumanSelect"
          />
          <template v-else>
            <button
              v-for="item in activeGroupChildren"
              :key="item.id"
              type="button"
              class="dialogue-workflow-select__item"
              :class="{ 'dialogue-workflow-select__item--active': item.id === modelValue }"
              @click="select(item.id)"
            >
              {{ item.name }}
            </button>
            <p v-if="!activeGroupChildren.length" class="dialogue-workflow-select__empty">暂无工作流</p>
          </template>
        </div>
      </template>
      <template v-else>
        <DigitalHumanPickerPanel
          v-if="showDigitalHumanPicker"
          :light="light"
          @back="closeDigitalHumanPicker"
          @select="onDigitalHumanSelect"
        />
        <template v-else>
          <button
            v-for="item in flatOptions"
            :key="item.id"
            type="button"
            class="dialogue-workflow-select__item"
            :class="{ 'dialogue-workflow-select__item--active': item.id === modelValue }"
            @click="select(item.id)"
          >
            {{ item.name }}
          </button>
          <p v-if="!flatOptions.length" class="dialogue-workflow-select__empty">暂无工作流</p>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DigitalHumanPickerPanel, {
  type DigitalHumanPickerItem,
} from './DigitalHumanPickerPanel.vue'
import {
  isMyModelWorkflow,
  type ImageWorkflowOption,
  type ImageWorkflowOptionGroup,
} from './constants'

export type DialogueWorkflowOption = {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options?: DialogueWorkflowOption[]
    groups?: ImageWorkflowOptionGroup[]
    placeholder?: string
    light?: boolean
  }>(),
  {
    modelValue: undefined,
    options: () => [],
    groups: () => [],
    placeholder: '选择工作流',
    light: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
  'select-digital-human': [item: DigitalHumanPickerItem]
}>()

const open = ref(false)
const activeCategoryId = ref('')
const showDigitalHumanPicker = ref(false)

const hasGroups = computed(() => props.groups.length > 0)

const flatOptions = computed(() => {
  if (hasGroups.value) {
    return props.groups.flatMap((group) => group.children)
  }
  return props.options
})

const activeGroupChildren = computed(() => {
  if (!hasGroups.value) return []
  const group =
    props.groups.find((item) => item.categoryId === activeCategoryId.value) ?? props.groups[0]
  return group?.children ?? []
})

const displayLabel = computed(() => {
  const selected = flatOptions.value.find((item) => item.id === props.modelValue)
  return selected?.name || props.placeholder
})

function syncActiveCategory() {
  if (!hasGroups.value) {
    activeCategoryId.value = ''
    return
  }

  const selectedGroup = props.groups.find((group) =>
    group.children.some((item) => item.id === props.modelValue),
  )
  activeCategoryId.value = selectedGroup?.categoryId ?? props.groups[0]?.categoryId ?? ''
}

function onCategoryHover(categoryId: string) {
  activeCategoryId.value = categoryId
  if (!isMyModelWorkflow(findWorkflowOption(props.modelValue ?? ''))) {
    showDigitalHumanPicker.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    syncActiveCategory()
  }
}

function close() {
  open.value = false
  showDigitalHumanPicker.value = false
}

function closeDigitalHumanPicker() {
  showDigitalHumanPicker.value = false
}

function findWorkflowOption(id: string): ImageWorkflowOption | undefined {
  return flatOptions.value.find((item) => item.id === id)
}

function select(id: string) {
  const item = findWorkflowOption(id)
  emit('update:modelValue', id)
  if (isMyModelWorkflow(item)) {
    showDigitalHumanPicker.value = true
    return
  }
  showDigitalHumanPicker.value = false
  close()
}

function onDigitalHumanSelect(item: DigitalHumanPickerItem) {
  emit('select-digital-human', item)
  close()
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.dialogue-workflow-select')) return
  close()
}

watch(
  () => [props.groups, props.modelValue],
  () => {
    if (open.value) {
      syncActiveCategory()
    }
  },
  { deep: true },
)

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  syncActiveCategory()
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
  left: 0;
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

.dialogue-workflow-select__menu--grouped {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: 320px;
  max-width: min(420px, calc(100vw - 32px));
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.dialogue-workflow-select__categories {
  flex: 0 0 132px;
  max-width: 132px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow-y: auto;
}

.dialogue-workflow-select__category {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
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

.dialogue-workflow-select__category-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialogue-workflow-select__category-arrow {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' fill='none' viewBox='0 0 8 8'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M3 1.5 5.5 4 3 6.5'/%3E%3C/svg%3E") center / 8px 8px no-repeat;
}

.dialogue-workflow-select__submenu {
  flex: 0 0 auto;
  width: 155px;
  min-width: 155px;
  max-width: 155px;
  align-self: flex-start;
  margin-left: 8px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  overflow: visible;
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

  .dialogue-workflow-select__menu--grouped {
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .dialogue-workflow-select__categories {
    border-color: #4b4b55;
    background: #252528;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .dialogue-workflow-select__submenu {
    border-color: #4b4b55;
    background: #252528;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .dialogue-workflow-select__category {
    color: #d1d5db;

    &:hover,
    &--active {
      background: #35353d;
    }

    &--active {
      color: #93c5fd;
    }
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
