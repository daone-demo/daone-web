<template>
  <header class="chat-panel__header">
    <div class="chat-panel__tabs" role="tablist">
      <div
        v-for="tab in openTabs"
        :key="tab.id"
        class="chat-panel__tab"
        :class="{ 'chat-panel__tab--active': tab.id === activeSessionId }"
        role="tab"
        :aria-selected="tab.id === activeSessionId"
        @click="emit('switch-session', tab.id)"
      >
        <span class="chat-panel__tab-title">{{ tab.title }}</span>
        <button
          type="button"
          class="chat-panel__tab-close"
          title="关闭标签"
          aria-label="关闭标签"
          @click.stop="emit('close-tab', tab.id)"
        >
          ×
        </button>
      </div>
    </div>
    <div class="chat-panel__header-actions">
      <button type="button" class="chat-panel__icon-btn" title="新建对话" aria-label="新建对话" @click="emit('new-chat')">
        <!-- <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" /> -->
        <i class="iconfont icon-tianjiajia" style="font-size: 18px;"></i>
      </button>
      <div class="chat-panel__history-wrap">
        <button
          type="button"
          class="chat-panel__icon-btn"
          title="历史记录"
          aria-label="历史记录"
          @click="toggleHistory"
        >
          <i class="iconfont icon-lishi" style="font-size: 18px;"></i>
          <!-- <span class="chat-panel__icon chat-panel__icon--history" aria-hidden="true" /> -->
        </button>
        <div v-if="showHistoryMenu" class="chat-panel__history-menu">
          <input
            v-model="historySearch"
            type="search"
            class="chat-panel__history-search"
            placeholder="搜索对话..."
          />
          <ul class="chat-panel__history-list">
            <li
              v-for="item in historySessions ?? []"
              :key="item.id"
              class="chat-panel__history-item"
              @click="emit('open-history', item)"
            >
              <span class="chat-panel__history-name">{{ item.title }}</span>
              <span class="chat-panel__history-meta">
                <span v-if="item.id === currentSessionId" class="chat-panel__history-badge">已打开</span>
                <span class="chat-panel__history-time">{{ dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
              </span>
            </li>
            <li v-if="!(historySessions ?? []).length" class="chat-panel__history-empty">暂无对话</li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        class="chat-panel__icon-btn"
        title="关闭"
        aria-label="关闭"
        @click="emit('close-chat')"
      >
        <!-- <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          aria-hidden="true"
          role="img"
          class="iconify iconify--libtv pointer-events-none text-current"
          width="14"
          height="14"
          viewBox="0 0 16 16"
        >
          <g transform="translate(2.1674 2.1675)">
            <path d="M0.523438 0C0.812784 6.62772e-05 1.04768 0.234117 1.04785 0.523438V11.1406C1.04774 11.43 0.812825 11.665 0.523438 11.665C0.234144 11.6649 0.000109648 11.4299 0 11.1406V0.523438C0.000175989 0.234185 0.234185 0.000175989 0.523438 0ZM6.78809 1.47949C6.99276 1.27491 7.32558 1.27495 7.53027 1.47949L11.5117 5.46094C11.7163 5.66563 11.7163 5.99845 11.5117 6.20312L7.53027 10.1846C7.32559 10.3891 6.99277 10.3891 6.78809 10.1846C6.58356 9.97989 6.58355 9.64706 6.78809 9.44238L9.875 6.35645H3.17773C2.88835 6.35637 2.65341 6.12142 2.65332 5.83203C2.65344 5.54267 2.88837 5.3077 3.17773 5.30762H9.875L6.78809 2.22168C6.58353 2.01697 6.58346 1.68416 6.78809 1.47949Z" fill="currentColor"></path>
          </g>
        </svg> -->
        <i class="iconfont icon-zhedie" style="font-size: 18px;"></i>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

interface TabItem {
  id: string
  title: string
}

interface HistorySession {
  id: string
  title?: string
  updatedAt?: string | number
  createdAt?: string | number
  [key: string]: unknown
}

defineProps<{
  openTabs: TabItem[]
  activeSessionId: string
  historySessions?: HistorySession[]
  currentSessionId?: string
}>()

const historySearch = defineModel<string>('historySearch', { default: '' })
const showHistoryMenu = defineModel<boolean>('showHistoryMenu', { default: false })

const emit = defineEmits<{
  'switch-session': [sessionId: string]
  'close-tab': [sessionId: string]
  'new-chat': []
  'toggle-history': []
  'open-history': [session: HistorySession]
  'close-chat': []
  'update:historySearch': [value: string]
  'update:showHistoryMenu': [value: boolean]
}>()

function toggleHistory() {
  emit('toggle-history')
}
</script>
