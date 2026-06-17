<template>
  <div class="image-style-modal" @mousedown.self="emit('close')">
    <div class="image-style-modal__panel" @mousedown.stop>
      <div class="image-style-modal__topbar">
        <div class="image-style-modal__search">
          <span class="image-style-modal__search-icon" aria-hidden="true" />
          <input
            v-model="keyword"
            type="text"
            class="image-style-modal__search-input"
            :placeholder="IMAGE_STYLE_PANEL_SEARCH_PLACEHOLDER"
          />
        </div>
        <button type="button" class="image-style-modal__close" title="关闭" @click="emit('close')">
          <span class="image-style-modal__close-icon" aria-hidden="true" />
        </button>
      </div>

      <div class="image-style-modal__tabbar">
        <div class="image-style-modal__tabs">
          <button
            v-for="tab in IMAGE_STYLE_PANEL_TABS"
            :key="tab"
            type="button"
            class="image-style-modal__tab"
            :class="{ 'image-style-modal__tab--active': tab === activeTab }"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>
        <div class="image-style-modal__tabbar-right">
          <button type="button" class="image-style-modal__chip">
            <span class="image-style-modal__chip-mark" aria-hidden="true" />
            Lib Image
          </button>
          <button type="button" class="image-style-modal__chip">
            推荐
            <span class="image-style-modal__chip-arrow" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="image-style-modal__grid">
        <button
          v-for="card in visibleCards"
          :key="card.key"
          type="button"
          class="image-style-modal__card"
          @click="emit('select', card)"
        >
          <span class="image-style-modal__card-thumb" :style="{ background: card.gradient }">
            <span class="image-style-modal__card-credits">
              <span class="image-style-modal__card-play" aria-hidden="true" />
              {{ card.credits }}
            </span>
          </span>
          <span class="image-style-modal__card-title">{{ card.title }}</span>
          <span class="image-style-modal__card-author">{{ card.author }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IMAGE_STYLE_PANEL_SEARCH_PLACEHOLDER,
  IMAGE_STYLE_PANEL_TABS,
  IMAGE_STYLE_PANEL_CARDS,
  type ImageStyleCard,
} from './constants'

const emit = defineEmits<{
  close: []
  select: [card: ImageStyleCard]
}>()

const activeTab = ref<(typeof IMAGE_STYLE_PANEL_TABS)[number]>(IMAGE_STYLE_PANEL_TABS[0])
const keyword = ref('')

const visibleCards = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return IMAGE_STYLE_PANEL_CARDS
  return IMAGE_STYLE_PANEL_CARDS.filter((card) => card.title.includes(kw))
})
</script>

<style scoped lang="scss">
.image-style-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.image-style-modal__panel {
  display: flex;
  flex-direction: column;
  width: min(1000px, 94vw);
  height: min(640px, 86vh);
  padding: 16px 20px 20px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3);
  overflow: hidden;
}

.image-style-modal__topbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.image-style-modal__search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 340px;
  max-width: 60%;
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f7f8fa;
}

.image-style-modal__search-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='4.5' stroke='%239ca3af' stroke-width='1.3'/%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-width='1.3' d='m10.5 10.5 3 3'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

.image-style-modal__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #1f2937;
  font-size: 13px;
  outline: none;

  &::placeholder {
    color: #9ca3af;
  }
}

.image-style-modal__close {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.image-style-modal__close-icon {
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.4' d='m4 4 8 8M12 4l-8 8'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

.image-style-modal__tabbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.image-style-modal__tabs {
  display: flex;
  align-items: center;
  gap: 18px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.image-style-modal__tab {
  flex-shrink: 0;
  padding: 4px 0;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: #1f2937;
  }
}

.image-style-modal__tab--active {
  color: #111827;
  font-weight: 600;
}

.image-style-modal__tabbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.image-style-modal__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
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
}

.image-style-modal__chip-mark {
  width: 12px;
  height: 12px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 12 12'%3E%3Cpath fill='%237c8cff' d='M6 1 7.1 4.3 10.4 5.4 7.1 6.5 6 9.8 4.9 6.5 1.6 5.4 4.9 4.3z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
}

.image-style-modal__chip-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.image-style-modal__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 14px 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.image-style-modal__card {
  display: flex;
  flex-direction: column;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover .image-style-modal__card-thumb {
    transform: translateY(-2px);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
  }
}

.image-style-modal__card-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.image-style-modal__card-credits {
  position: absolute;
  left: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.55);
  color: #fff;
  font-size: 10px;
  line-height: 1;
}

.image-style-modal__card-play {
  width: 8px;
  height: 8px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' fill='none' viewBox='0 0 8 8'%3E%3Cpath fill='%23fff' d='M2 1.5 6.5 4 2 6.5z'/%3E%3C/svg%3E") center / 8px 8px no-repeat;
}

.image-style-modal__card-title {
  margin-top: 6px;
  color: #1f2937;
  font-size: 12px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-style-modal__card-author {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
