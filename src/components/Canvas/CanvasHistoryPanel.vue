<template>
  <aside class="canvas-history" role="dialog" aria-labelledby="canvas-history-title" @mousedown.stop>
    <header class="canvas-history__head">
      <h2 id="canvas-history-title" class="canvas-history__title">历史记录</h2>
      <button
        type="button"
        class="canvas-history__close"
        title="关闭"
        aria-label="关闭历史记录"
        @click="emit('close')"
      >
        ×
      </button>
    </header>

    <div class="canvas-history__toolbar">
      <label class="canvas-history__search">
        <span class="canvas-history__search-icon" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="search"
          class="canvas-history__search-input"
          placeholder="搜索 历史记录"
          autocomplete="off"
        />
      </label>
      <button type="button" class="canvas-history__calendar" title="按日期筛选" aria-label="按日期筛选">
        <span class="canvas-history__calendar-icon" aria-hidden="true" />
      </button>
    </div>

    <nav class="canvas-history__tabs" aria-label="历史记录分类">
      <button
        v-for="tab in HISTORY_RECORD_TABS"
        :key="tab.key"
        type="button"
        class="canvas-history__tab"
        :class="{ 'canvas-history__tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="canvas-history__body">
      <template v-if="groupedRecords.length">
        <section
          v-for="group in groupedRecords"
          :key="group.dateKey"
          class="canvas-history__group"
        >
          <h3 class="canvas-history__date">{{ group.dateLabel }}</h3>
          <ul class="canvas-history__list">
            <li v-for="item in group.items" :key="item.id" class="canvas-history__item">
              <button type="button" class="canvas-history__item-btn">
                <span class="canvas-history__item-text">{{ item.summary }}</span>
                <time class="canvas-history__item-time" :datetime="item.time">{{ item.time }}</time>
              </button>
            </li>
          </ul>
        </section>
      </template>
      <p v-else class="canvas-history__empty">暂无匹配的历史记录</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CANVAS_HISTORY_RECORDS,
  HISTORY_RECORD_TABS,
  type HistoryRecord,
  type HistoryRecordTab,
} from './canvasHistoryRecords'

const emit = defineEmits<{
  close: []
}>()

const searchQuery = ref('')
const activeTab = ref<HistoryRecordTab>('all')

const filteredRecords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return CANVAS_HISTORY_RECORDS.filter((record) => {
    if (activeTab.value !== 'all' && record.kind !== activeTab.value) return false
    if (!q) return true
    return record.summary.toLowerCase().includes(q)
  })
})

const groupedRecords = computed(() => {
  const map = new Map<string, { dateKey: string; dateLabel: string; items: HistoryRecord[] }>()
  filteredRecords.value.forEach((record) => {
    const existing = map.get(record.dateKey)
    if (existing) {
      existing.items.push(record)
      return
    }
    map.set(record.dateKey, {
      dateKey: record.dateKey,
      dateLabel: record.dateLabel,
      items: [record],
    })
  })
  return [...map.values()]
})
</script>

<style scoped lang="scss">
.canvas-history {
  display: flex;
  flex-direction: column;
  width: 360px;
  max-height: min(560px, calc(100vh - 120px));
  border: 1px solid #e8eaed;
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0 4px 24px rgba(15, 23, 42, 0.08),
    0 1px 3px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  pointer-events: auto;
}

.canvas-history__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 18px 12px;
}

.canvas-history__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.01em;
}

.canvas-history__close {
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

.canvas-history__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px 12px;
}

.canvas-history__search {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: #f3f4f6;
}

.canvas-history__search-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Ccircle cx='7' cy='7' r='4.5' stroke='%239ca3af' stroke-width='1.2'/%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-width='1.2' d='m10.5 10.5 2.5 2.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.canvas-history__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #111827;
  outline: none;

  &::placeholder {
    color: #9ca3af;
  }
}

.canvas-history__calendar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: #f3f4f6;
  cursor: pointer;

  &:hover {
    background: #e5e7eb;
  }
}

.canvas-history__calendar-icon {
  width: 18px;
  height: 18px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Crect x='3' y='4.5' width='12' height='10' rx='1.5' stroke='%236b7280' stroke-width='1.2'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.2' d='M3 7.5h12M6 3v2M12 3v2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.canvas-history__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f1f3;
}

.canvas-history__tab {
  position: relative;
  padding: 10px 10px 12px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: #374151;
  }

  &--active {
    color: #111827;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      right: 8px;
      bottom: 0;
      left: 8px;
      height: 2px;
      border-radius: 2px 2px 0 0;
      background: #111827;
    }
  }
}

.canvas-history__body {
  flex: 1;
  min-height: 0;
  padding: 8px 4px 12px 16px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: #d1d5db;
  }
}

.canvas-history__group + .canvas-history__group {
  margin-top: 8px;
}

.canvas-history__date {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.canvas-history__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.canvas-history__item-btn {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px 10px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}

.canvas-history__item-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #374151;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.canvas-history__item-time {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}

.canvas-history__empty {
  margin: 32px 0;
  padding-right: 12px;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
}
</style>
