<template>
  <div
    class="digital-human-picker"
    :class="{ 'digital-human-picker--dark': !light }"
    @mousedown.stop
  >
    <div class="digital-human-picker__head">
      <button
        v-if="showBack"
        type="button"
        class="digital-human-picker__back"
        title="返回"
        @click="emit('back')"
      >
        <span aria-hidden="true" />
      </button>
      <span class="digital-human-picker__title">我的数字人</span>
    </div>

    <div
      class="digital-human-picker__body"
      @scroll.passive="onGridScroll"
    >
      <div class="digital-human-picker__grid">
        <button
          v-for="item in list"
          :key="item.id"
          type="button"
          class="digital-human-picker__item"
          @click="onSelect(item)"
          @mouseenter="onItemMouseEnter(item, $event)"
          @mouseleave="onItemMouseLeave"
        >
          <img
            class="digital-human-picker__image"
            :src="item.previewUrl"
            alt="数字人"
            loading="lazy"
            draggable="false"
          />
        </button>
      </div>

      <p v-if="loading" class="digital-human-picker__hint">加载中...</p>
      <p v-else-if="!list.length" class="digital-human-picker__hint">暂无数字人</p>
      <p v-else-if="!hasMore" class="digital-human-picker__hint">没有更多了</p>
    </div>

    <Teleport to="body">
      <div
        v-if="hoveredItem && previewPosition"
        class="digital-human-picker__preview"
        :class="{ 'digital-human-picker__preview--dark': !light }"
        :style="previewPosition"
      >
        <img :src="hoveredItem.previewUrl" alt="" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'
import api from '@/services/api'

export type DigitalHumanPickerItem = {
  id: string
  assetId: string
  previewUrl: string
}

const PAGE_SIZE = 30

const props = withDefaults(
  defineProps<{
    light?: boolean
    showBack?: boolean
  }>(),
  {
    light: true,
    showBack: true,
  },
)

const emit = defineEmits<{
  select: [item: DigitalHumanPickerItem]
  back: []
}>()

const list = ref<DigitalHumanPickerItem[]>([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const hoveredItem = ref<DigitalHumanPickerItem | null>(null)
const hoveredAnchorEl = ref<HTMLElement | null>(null)
const previewPosition = ref<CSSProperties | null>(null)

function updatePreviewPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  previewPosition.value = {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 8}px`,
    transform: 'translate(-50%, -100%)',
    zIndex: 10000,
  }
}

function onItemMouseEnter(item: DigitalHumanPickerItem, event: MouseEvent) {
  const anchor = event.currentTarget as HTMLElement | null
  if (!anchor) return
  hoveredItem.value = item
  hoveredAnchorEl.value = anchor
  updatePreviewPosition(anchor)
}

function onItemMouseLeave() {
  hoveredItem.value = null
  hoveredAnchorEl.value = null
  previewPosition.value = null
}

function normalizeItem(record: Record<string, unknown>): DigitalHumanPickerItem | null {
  const assetId = record.assetId ?? record.id
  const previewUrl = String(record.previewUrl ?? '').trim()
  if (!assetId || !previewUrl) return null
  return {
    id: String(record.id ?? assetId),
    assetId: String(assetId),
    previewUrl,
  }
}

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const res = await api.getDigitalHumans({
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    const records = (res.records ?? []) as Record<string, unknown>[]
    const normalized = records
      .map((item) => normalizeItem(item))
      .filter((item): item is DigitalHumanPickerItem => Boolean(item))
    const total = Number(res.total ?? normalized.length)

    if (page.value === 1) {
      list.value = normalized
    } else {
      list.value = [...list.value, ...normalized]
    }

    page.value += 1
    hasMore.value = list.value.length < total && normalized.length > 0
  } catch (error) {
    console.error('[DigitalHumanPicker] load failed', error)
  } finally {
    loading.value = false
  }
}

function onGridScroll(event: Event) {
  if (hoveredAnchorEl.value) {
    updatePreviewPosition(hoveredAnchorEl.value)
  }
  if (loading.value || !hasMore.value) return
  const el = event.target as HTMLElement
  if (!el) return
  const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
  if (reachedBottom) {
    void loadMore()
  }
}

function onSelect(item: DigitalHumanPickerItem) {
  onItemMouseLeave()
  emit('select', item)
}

function onWindowScroll() {
  if (hoveredAnchorEl.value) {
    updatePreviewPosition(hoveredAnchorEl.value)
  }
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, true)
  void loadMore()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll, true)
})
</script>

<style scoped lang="scss">
.digital-human-picker {
  display: flex;
  flex-direction: column;
  width: 155px;
  max-height: min(320px, calc(100vh - 160px));
}

.digital-human-picker__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 8px;
  flex-shrink: 0;
}

.digital-human-picker__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  span {
    width: 8px;
    height: 8px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' fill='none' viewBox='0 0 8 8'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M5 1.5 2.5 4 5 6.5'/%3E%3C/svg%3E") center / 8px 8px no-repeat;
  }

  &:hover {
    background: #f3f4f6;
  }
}

.digital-human-picker__title {
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.digital-human-picker__body {
  flex: 1;
  min-height: 0;
  max-height: min(280px, calc(100vh - 220px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 2px;
}

.digital-human-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, 43px);
  gap: 6px;
  justify-content: start;
}

.digital-human-picker__item {
  position: relative;
  flex-shrink: 0;
  width: 43px;
  height: 43px;
  padding: 0;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  background: #f9fafb;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(79, 70, 229, 0.45);
    transform: translateY(-1px);
  }
}

.digital-human-picker__image {
  display: block;
  width: 43px;
  height: 43px;
  object-fit: cover;
  border-radius: 7px;
}

.digital-human-picker__preview {
  padding: 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.22);
  pointer-events: none;

  img {
    display: block;
    width: 150px;
    max-height: 260px;
    object-fit: contain;
    border-radius: 8px;
  }

  &--dark {
    background: #252528;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  }
}

.digital-human-picker__hint {
  margin: 8px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
}

.digital-human-picker--dark {
  .digital-human-picker__back:hover {
    background: #35353d;
  }

  .digital-human-picker__title {
    color: #d1d5db;
  }

  .digital-human-picker__item {
    border-color: #4b4b55;
    background: #2f2f35;

    &:hover {
      border-color: rgba(107, 124, 255, 0.55);
    }
  }

  .digital-human-picker__hint {
    color: #9ca3af;
  }
}
</style>
