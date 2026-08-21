<template>
  <div
    class="prompt-at-mention-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @mousedown.stop
  >
    <!-- <div class="prompt-at-mention-menu__search">
      <span class="prompt-at-mention-menu__search-icon" aria-hidden="true" />
      <input
        ref="searchInputRef"
        v-model="searchText"
        type="text"
        class="prompt-at-mention-menu__search-input"
        placeholder="搜索"
        @keydown.stop="onSearchKeydown"
      />
    </div> -->
    <div class="prompt-at-mention-menu__section-title">已引用</div>
    <div class="prompt-at-mention-menu__list" role="listbox">
      <button
        v-for="(item, index) in filteredItems"
        :key="item.key"
        type="button"
        class="prompt-at-mention-menu__item"
        :class="{ 'prompt-at-mention-menu__item--active': index === activeIndex }"
        role="option"
        :aria-selected="index === activeIndex"
        @mouseenter="activeIndex = index"
        @click.stop="emit('select', item)"
      >
        <img :src="item.previewUrl" alt="" class="prompt-at-mention-menu__thumb" />
        <span class="prompt-at-mention-menu__label">{{ item.label }}</span>
      </button>
      <div v-if="!filteredItems.length" class="prompt-at-mention-menu__empty">无匹配图片</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export interface PromptAtMentionItem {
  key: string
  index: number
  previewUrl: string
  label: string
  nodeId?: string
}

const props = defineProps<{
  items: PromptAtMentionItem[]
  query?: string
  left: number
  top: number
}>()

const emit = defineEmits<{
  select: [item: PromptAtMentionItem]
  close: []
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchText = ref('')
const activeIndex = ref(0)

const filteredItems = computed(() => {
  const q = (searchText.value || props.query || '').trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter((item) => {
    const label = item.label.toLowerCase()
    const indexLabel = `图片${item.index}`
    const indexLabelSpaced = `图片 ${item.index}`
    return (
      label.includes(q) ||
      indexLabel.includes(q) ||
      indexLabelSpaced.includes(q) ||
      String(item.index).includes(q)
    )
  })
})

watch(
  () => props.query,
  (value) => {
    if (value !== undefined) searchText.value = value
  },
  { immediate: true },
)

watch(filteredItems, () => {
  activeIndex.value = 0
})

watch(
  () => props.items,
  () => {
    activeIndex.value = 0
  },
)

function moveActive(delta: number) {
  const len = filteredItems.value.length
  if (!len) return
  activeIndex.value = (activeIndex.value + delta + len) % len
}

function confirmActive() {
  const item = filteredItems.value[activeIndex.value]
  if (!item) return
  emit('select', item)
}

// function onSearchKeydown(event: KeyboardEvent) {
//   if (event.key === 'ArrowDown') {
//     event.preventDefault()
//     moveActive(1)
//     return
//   }
//   if (event.key === 'ArrowUp') {
//     event.preventDefault()
//     moveActive(-1)
//     return
//   }
//   if (event.key === 'Enter') {
//     event.preventDefault()
//     confirmActive()
//     return
//   }
//   if (event.key === 'Escape') {
//     event.preventDefault()
//     emit('close')
//   }
// }

defineExpose({
  moveActive,
  confirmActive,
  focusSearch: () => {
    nextTick(() => searchInputRef.value?.focus())
  },
})
</script>

<style scoped lang="scss">
.prompt-at-mention-menu {
  position: fixed;
  z-index: 4000;
  width: 260px;
  padding: 10px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  border: 1px solid #eef0f3;
}

.prompt-at-mention-menu__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border-radius: 10px;
  background: #f5f6f8;
}

.prompt-at-mention-menu__search-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  background-color: #9ca3af;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='11' cy='11' r='7' stroke='black' stroke-width='2'/%3E%3Cpath d='M20 20l-3.5-3.5' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")
    center / contain no-repeat;
}

.prompt-at-mention-menu__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #111827;
  font-size: 13px;
  line-height: 1.2;

  &::placeholder {
    color: #9ca3af;
  }
}

.prompt-at-mention-menu__section-title {
  margin: 10px 4px 6px;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.2;
}

.prompt-at-mention-menu__list {
  max-height: 220px;
  overflow: auto;
}

.prompt-at-mention-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #111827;
  text-align: left;
  cursor: pointer;

  &--active,
  &:hover {
    background: #f3f4f6;
  }
}

.prompt-at-mention-menu__thumb {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  background: #e5e7eb;
}

.prompt-at-mention-menu__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.3;
}

.prompt-at-mention-menu__empty {
  padding: 16px 8px;
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
}
</style>
