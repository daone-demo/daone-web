<template>
  <div class="project-page">
    <div class="project-browser" role="region" aria-label="我的项目">
      <aside class="project-browser__sidebar" aria-label="项目分类">
        <button
          v-for="tab in PROJECT_BROWSER_TABS"
          :key="tab.key"
          type="button"
          class="project-browser__tab"
          :class="{ 'project-browser__tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span
            class="project-browser__tab-icon"
            :class="`project-browser__tab-icon--${tab.icon}`"
            aria-hidden="true"
          />
          <span>{{ tab.label }}</span>
        </button>
      </aside>

      <div class="project-browser__main">
        <header class="project-browser__top">
          <div class="project-browser__search-wrap">
            <span class="project-browser__search-icon" aria-hidden="true" />
            <input
              v-model="searchKeyword"
              type="search"
              class="project-browser__search"
              placeholder="搜索..."
              @keydown.enter.prevent="reloadProjects"
            />
            <button
              v-if="searchKeyword"
              type="button"
              class="project-browser__search-clear"
              aria-label="清除搜索"
              @click="clearSearch"
            >
              ×
            </button>
          </div>
        </header>

        <h2 class="project-browser__heading">{{ activeTabLabel }}</h2>

        <div v-if="activeTab !== 'mine'" class="project-browser__empty">
          功能开发中，敬请期待
        </div>

        <template v-else>
          <div v-if="loading" class="project-browser__status">加载中...</div>
          <div v-else class="project-browser__grid">
            <article
              v-for="project in projects"
              :key="project.id"
              class="project-browser__card"
              @click="openProject(project.id)"
            >
              <div class="project-browser__card-media">
                <img
                  v-if="project.coverUrl"
                  :src="project.coverUrl"
                  :alt="project.title"
                  class="project-browser__card-img"
                  loading="lazy"
                  draggable="false"
                />
                <span v-else class="project-browser__card-cover" aria-hidden="true" />
              </div>
              <div class="project-browser__card-head">
                <span class="project-browser__card-title">{{ project.title }}</span>
                <div class="project-browser__card-actions">
                  <a-dropdown :trigger="['click']" placement="bottomRight">
                    <a-button type="default" @click.stop.prevent>
                      <MoreOutlined />
                    </a-button>
                    <template #overlay>
                      <a-menu class="project-browser__menu">
                        <a-menu-item @click="openRenameProject(project.id, project.title)">
                          <template #icon>
                            <i class="iconfont icon-zhongmingming" />
                          </template>
                          重命名
                        </a-menu-item>
                        <a-menu-item danger @click="openDeleteProject(project.id)">
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
              <span class="project-browser__card-meta">
                更新于 {{ formatDate(project.updatedAt) }}
              </span>
            </article>
          </div>

          <footer v-if="total > 0" class="project-browser__footer">
            <span class="project-browser__range">
              显示 {{ rangeStart }}-{{ rangeEnd }} 共 {{ total }} 个项目
            </span>
            <a-pagination
              class="project-browser__pagination"
              size="small"
              :current="page"
              :page-size="pageSize"
              :total="total"
              :page-size-options="PAGE_SIZE_OPTIONS"
              :locale="PAGINATION_LOCALE"
              show-size-changer
              @change="onPaginationChange"
            />
          </footer>
        </template>
      </div>
    </div>

    <UpdateProjectName
      v-model:open="modalStore.updateProjectNameVisible"
      v-model:project-id="renameProjectId"
      v-model:project-name="renameProjectName"
      @submit="reloadProjects"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, createVNode, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { Modal } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { ExclamationCircleFilled, MoreOutlined } from '@ant-design/icons-vue'
import UpdateProjectName from '@components/UpdateProjectName/index.vue'
import { useModalStore } from '@stores/useModal'
import api from '@/services/api'

type ProjectItem = {
  id: string
  title: string
  coverAssetId: string | null
  coverUrl: string | null
  revision: number
  createdAt: string
  updatedAt: string
}

const PROJECT_BROWSER_TABS = [
  { key: 'mine', label: '我的项目', icon: 'folder' },
] as const

type ProjectBrowserTabKey = (typeof PROJECT_BROWSER_TABS)[number]['key']

const PAGE_SIZE_OPTIONS: (string | number)[] = ['8', '16', '24']
const PAGINATION_LOCALE = zhCN.Pagination

const router = useRouter()
const modalStore = useModalStore()

const activeTab = ref<ProjectBrowserTabKey>('mine')
const searchKeyword = ref('')
const projects = ref<ProjectItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(8)
const total = ref(0)
const renameProjectId = ref('')
const renameProjectName = ref('')

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
    const res = await api.getProjects<ProjectItem>({
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
    console.error('[Project] load projects failed', error)
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

function onPaginationChange(nextPage: number, nextPageSize: number) {
  page.value = nextPage
  pageSize.value = nextPageSize
  void loadProjects()
}

function openProject(projectId: string) {
  void router.push({ name: 'projectDetail', params: { id: projectId } })
}

function openRenameProject(projectId: string, name: string) {
  renameProjectId.value = projectId
  renameProjectName.value = name
  modalStore.openModal('updateProjectName')
}

function openDeleteProject(projectId: string) {
  Modal.confirm({
    title: '确定要删除此项目吗？',
    icon: createVNode(ExclamationCircleFilled),
    content: '删除后将无法恢复，请谨慎操作。',
    okText: '确定',
    cancelText: '取消',
    onOk() {
      return api.deleteProject(projectId).then(() => {
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
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
