<template>
  <Transition name="canvas-project-browser-fade">
    <div class="canvas__project-browser-backdrop" @mousedown.self="emit('close')">
      <div
        class="canvas__project-browser"
        role="dialog"
        aria-modal="true"
        aria-label="我的项目"
        @mousedown.stop
      >
        <aside class="canvas__project-browser-sidebar" aria-label="项目分类">
          <button
            v-for="tab in PROJECT_BROWSER_TABS"
            :key="tab.key"
            type="button"
            class="canvas__project-browser-tab"
            :class="{ 'canvas__project-browser-tab--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <span
              class="canvas__project-browser-tab-icon"
              :class="`canvas__project-browser-tab-icon--${tab.icon}`"
              aria-hidden="true"
            />
            <span>{{ tab.label }}</span>
          </button>
        </aside>

        <div class="canvas__project-browser-main">
          <header class="canvas__project-browser-top">
            <div class="canvas__project-browser-search-wrap">
              <span class="canvas__project-browser-search-icon" aria-hidden="true" />
              <input
                v-model="searchKeyword"
                type="search"
                class="canvas__project-browser-search"
                placeholder="搜索..."
                @keydown.enter.prevent="reloadProjects"
              />
              <button
                v-if="searchKeyword"
                type="button"
                class="canvas__project-browser-search-clear"
                aria-label="清除搜索"
                @click="clearSearch"
              >
                ×
              </button>
            </div>
            <button
              type="button"
              class="canvas__project-browser-close"
              aria-label="关闭"
              @click="emit('close')"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <h2 class="canvas__project-browser-heading">{{ activeTabLabel }}</h2>

          <div v-if="activeTab !== 'mine'" class="canvas__project-browser-empty">
            功能开发中，敬请期待
          </div>

          <template v-else>
            <div v-if="loading" class="canvas__project-browser-status">加载中...</div>
            <div v-else-if="!projects.length" class="canvas__project-browser-grid">
              <button
                type="button"
                class="canvas__project-browser-card canvas__project-browser-card--new"
                @click="onNewProject"
              >
                <span class="canvas__project-browser-new-icon" aria-hidden="true">
                  <i class="iconfont icon-icon-test" />
                </span>
                <span class="canvas__project-browser-new-label">新建项目</span>
              </button>
              <p class="canvas__project-browser-status canvas__project-browser-status--inline">暂无项目</p>
            </div>

            <div v-else class="canvas__project-browser-grid">
              <button
                type="button"
                class="canvas__project-browser-card canvas__project-browser-card--new"
                @click="onNewProject"
              >
                <span class="canvas__project-browser-new-icon" aria-hidden="true">
                  <i class="iconfont icon-icon-test" />
                </span>
                <span class="canvas__project-browser-new-label">新建项目</span>
              </button>

              <article
                v-for="project in projects"
                :key="project.id"
                class="canvas__project-browser-card"
                @click="onSelectProject(project.id)"
              >
                <div class="canvas__project-browser-card-media">
                  <img
                    v-if="project.coverUrl"
                    :src="project.coverUrl"
                    :alt="project.title"
                    class="canvas__project-browser-card-img"
                    loading="lazy"
                    draggable="false"
                  />
                  <span v-else class="canvas__project-browser-card-cover" aria-hidden="true" />
                  <span
                    v-if="project.id === activeProjectId"
                    class="canvas__project-browser-card-badge"
                  >
                    已打开
                  </span>
                </div>
                <div class="canvas__project-browser-card-head">
                  <span class="canvas__project-browser-card-title">{{ project.title }}</span>
                  <div class="canvas__project-browser-card-actions">
                    <a-dropdown :trigger="['click']" placement="bottomRight">
                      <a-button type="default" @click.stop.prevent>
                        <MoreOutlined />
                      </a-button>
                      <template #overlay>
                        <a-menu class="canvas__project-browser-menu">
                          <a-menu-item @click="onRenameProject(project.id, project.title)">
                            <template #icon>
                              <i class="iconfont icon-zhongmingming" />
                            </template>
                            重命名
                          </a-menu-item>
                          <a-menu-item danger @click="onDeleteProject(project.id)">
                            <template #icon>
                              <i class="iconfont icon-shanchu1" />
                            </template>
                            删除
                          </a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown>
                  </div>
                </div>
                <span class="canvas__project-browser-card-meta">
                  更新于 {{ formatDate(project.updatedAt) }}
                </span>
              </article>
            </div>

            <footer v-if="total > 0" class="canvas__project-browser-footer">
              <span class="canvas__project-browser-range">
                显示 {{ rangeStart }}-{{ rangeEnd }} 共 {{ total }} 个项目
              </span>
              <div class="canvas__project-browser-pagination">
                <button
                  type="button"
                  class="canvas__project-browser-page-btn"
                  :disabled="page <= 1"
                  aria-label="上一页"
                  @click="goPage(page - 1)"
                >
                  ‹
                </button>
                <span class="canvas__project-browser-page-current">{{ page }}</span>
                <button
                  type="button"
                  class="canvas__project-browser-page-btn"
                  :disabled="page >= totalPages"
                  aria-label="下一页"
                  @click="goPage(page + 1)"
                >
                  ›
                </button>
                <select
                  class="canvas__project-browser-page-size"
                  :value="pageSize"
                  @change="onPageSizeChange"
                >
                  <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
                    每页 {{ size }} 条
                  </option>
                </select>
              </div>
            </footer>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, createVNode, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Modal } from 'ant-design-vue'
import { ExclamationCircleFilled, MoreOutlined } from '@ant-design/icons-vue'
import api from '@/services/api'
import type { CanvasProjectItem } from './CanvasHeader.vue'

const PROJECT_BROWSER_TABS = [
  { key: 'mine', label: '我的项目', icon: 'folder' },
] as const

type ProjectBrowserTabKey = (typeof PROJECT_BROWSER_TABS)[number]['key']

const PAGE_SIZE_OPTIONS = [8, 16, 24]

defineProps<{
  activeProjectId: string
}>()

const emit = defineEmits<{
  close: []
  'select-project': [projectId: string]
  'new-project': []
  'rename-project': [projectId: string, name: string]
  'delete-project': [projectId: string]
}>()

const activeTab = ref<ProjectBrowserTabKey>('mine')
const searchKeyword = ref('')
const projects = ref<CanvasProjectItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(8)
const total = ref(0)

const activeTabLabel = computed(
  () => PROJECT_BROWSER_TABS.find((tab) => tab.key === activeTab.value)?.label ?? '我的项目',
)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const rangeStart = computed(() => {
  if (!total.value) return 0
  return (page.value - 1) * pageSize.value + 1
})

const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))

let searchTimer: ReturnType<typeof setTimeout> | null = null

function formatDate(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

async function loadProjects() {
  if (activeTab.value !== 'mine') return
  loading.value = true
  try {
    const res = await api.getProjects<CanvasProjectItem>({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value.trim() || undefined,
    })
    projects.value = res.records ?? []
    total.value = res.total ?? 0
    if (page.value > totalPages.value && totalPages.value > 0) {
      page.value = totalPages.value
      await loadProjects()
    }
  } catch (error) {
    console.error('[Canvas] load project browser failed', error)
    projects.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function reloadProjects() {
  page.value = 1
  void loadProjects()
}

function clearSearch() {
  searchKeyword.value = ''
  reloadProjects()
}

function goPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value) return
  page.value = nextPage
  void loadProjects()
}

function onPageSizeChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (!PAGE_SIZE_OPTIONS.includes(value)) return
  pageSize.value = value
  page.value = 1
  void loadProjects()
}

function onSelectProject(projectId: string) {
  emit('select-project', projectId)
  emit('close')
}

function onNewProject() {
  emit('new-project')
  emit('close')
}

function onRenameProject(projectId: string, name: string) {
  emit('rename-project', projectId, name)
}

function onDeleteProject(projectId: string) {
  Modal.confirm({
    title: '确定要删除此项目吗？',
    icon: createVNode(ExclamationCircleFilled),
    content: '删除后将无法恢复，请谨慎操作。',
    onOk() {
      return api.deleteProject(projectId).then(() => {
        emit('delete-project', projectId)
        void loadProjects()
      })
    },
  })
}

watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    reloadProjects()
  }, 300)
})

watch(activeTab, () => {
  if (activeTab.value === 'mine') {
    reloadProjects()
  }
})

onMounted(() => {
  void loadProjects()
})

defineExpose({ reload: loadProjects })
</script>
