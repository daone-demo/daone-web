<template>
  <div class="home">
    <div class="home__content">
      <section class="home__hero">
        <div class="home__hero-brand">
          <!-- <span class="home__hero-logo" aria-hidden="true" /> -->
          <h1 class="home__hero-title">
            <img src="@assets/images/logo_black.png" alt="Daone" class="home__hero-logo" />Daone 电商视觉AI生产平台</h1>
          <p class="home__hero-subtitle">生产真正懂审美、能卖货的视觉内容</p>
          <a-flex justify="center" align="center" gap="10px">
            <a-button type="primary" class="home__hero-create" @click="openNewProject">开始创作</a-button>
            <a-button type="default" class="home__hero-voideo" @click="onShowDemo">查看演示</a-button>
          </a-flex>
        </div>
      </section>

      <section class="home__section">
        <h2 class="home__section-title">最近项目</h2>
        <div class="home__projects">
          <div class="home__project-card home__project-card--new" @click="openNewProject">
            <span class="home__project-new-icon" aria-hidden="true">
              <i class="iconfont icon-icon-test"></i>
            </span>
            <span class="home__project-new-label">新建项目</span>
          </div>

          <div
            v-for="project in recentProjects"
            :key="project.id"
            class="home__project-card"
            @click="openProject(project.id)"
          >
            <img
              v-if="project.coverUrl"
              :src="project.coverUrl"
              class="home__project-img"
              loading="lazy"
            />
            <span v-else class="home__project-cover" aria-hidden="true" />
            <div class="flexBox">
              <span class="home__project-name">{{ project.title }}</span>
              <div class="home__project-actions">
                <a-dropdown :trigger="['click']">
                  <a-button type="default" @click.stop.prevent>
                    <MoreOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu class="home__project-menu">
                      <a-menu-item @click="openUpdateProjectName(project.id, project.title)">
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
            <span class="home__project-meta">更新于 {{ dayjs(project.updatedAt).format('YYYY-MM-DD HH:mm:ss') }}</span>
          </div>
        </div>
      </section>

      <section class="home__section home__section--inspiration">
        <h2 class="home__section-title">灵感发现</h2>

        <div class="home__filters">
          <button
            v-for="category in inspirationCategories"
            :key="category.code"
            type="button"
            class="home__filter-btn"
            :class="{ 'home__filter-btn--active': activeCategoryCode === category.code }"
            @click="selectPrimaryCategory(category)"
          >
            {{ category.name }}
          </button>
        </div>

        <div
          v-if="activeSubCategories.length > 0"
          class="home__filters home__filters--sub"
        >
          <button
            v-for="subCategory in activeSubCategories"
            :key="subCategory.code"
            type="button"
            class="home__filter-btn home__filter-btn--sub"
            :class="{ 'home__filter-btn--active': activeSubCategoryCode === subCategory.code }"
            @click="selectSubCategory(subCategory.code)"
          >
            {{ subCategory.name }}
          </button>
        </div>

        <div class="home__inspiration-grid">
          <div
            v-for="(column, columnIndex) in inspirationColumns"
            :key="columnIndex"
            class="home__inspiration-column"
          >
            <article
              v-for="item in column"
              :key="item.id"
              class="home__inspiration-card"
              @click="openInspiration(item)"
            >
              <div
                class="home__inspiration-media"
                :class="{ 'home__inspiration-media--video': item.mediaType === 'video' }"
              >
                <img
                  v-if="item.mediaType === 'image'"
                  class="home__inspiration-image"
                  :src="item.coverUrl"
                  :alt="`${item.authorName} 的作品`"
                  loading="lazy"
                />
                <EmbeddedVideoPlayer
                  v-else-if="item.mediaType === 'video'"
                  :src="item.coverUrl"
                />
              </div>
              <div class="home__inspiration-footer">
                <div class="home__inspiration-author">
                  <!-- <img class="home__inspiration-avatar" :src="item.authorName" :alt="item.author" loading="lazy" /> -->
                  <span class="home__inspiration-name">{{ item.authorName }}</span>
                </div>
                <div class="home__inspiration-stats">
                  <span class="home__inspiration-stat">
                    <span class="home__inspiration-stat-icon home__inspiration-stat-icon--view" aria-hidden="true" />
                    {{ formatCount(item.viewCount) }}
                  </span>
                  <span class="home__inspiration-stat" @click.stop.prevent="onFavorite(item.id, Boolean(item.favorited))">
                    <!-- <span class="home__inspiration-stat-icon home__inspiration-stat-icon--like" aria-hidden="true" /> -->
                    <img
                      :src="item.favorited ? collectIcon : uncollectIcon"
                      alt="收藏"
                      style="width: 16px; height: 16px;"
                    />
                    {{ formatCount(item.likeCount) }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>
  <UpdateProjectName
    v-model:open="modalStore.updateProjectNameVisible"
    v-model:project-id="projectId"
    v-model:project-name="projectName"
    @submit="onRefreshProjects"
  />
  <a-modal 
    v-model:open="open"
    width="800px"
    class="home__inspiration-modal"
  >
    <img
      v-if="inspirationsInfo.mediaType === 'image'"
      :src="inspirationsInfo.coverUrl"
      :alt="inspirationsInfo.title"
      style="width: 100%; height: 100%;"
    />
    <EmbeddedVideoPlayer
      v-if="inspirationsInfo.mediaType === 'video'"
      :src="inspirationsInfo.coverUrl"
      object-fit="contain"
      aspect-ratio="auto"
      min-height="360px"
      class="home__inspiration-modal-player"
    />
    <template #title></template>
    <template #footer></template>
  </a-modal>
  <a-modal 
    v-model:open="visable" 
    width="800px"
    class="home__inspiration-modal"
  >
    <EmbeddedVideoPlayer
      src="https://daone-oss.oss-accelerate.aliyuncs.com/video/100001/5baead5f-9cea-469a-a075-f45b38bf00c9.mp4"
      object-fit="contain"
      aspect-ratio="auto"
      min-height="360px"
      class="home__inspiration-modal-player"
    />
    <template #title></template>
    <template #footer></template>
  </a-modal>
</template>

<script setup lang="ts">
import collectIcon from '@assets/images/collect.png'
import uncollectIcon from '@assets/images/uncollect.png'
import { ExclamationCircleFilled, MoreOutlined } from '@ant-design/icons-vue'
import { computed, createVNode, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import api from '@/services/api';
import {
  type HomeInspirationCategoryItem,
} from './homeData'
import dayjs from 'dayjs';
import UpdateProjectName from '@components/UpdateProjectName/index.vue';
import EmbeddedVideoPlayer from '@components/EmbeddedVideoPlayer/index.vue';
import { Modal, message } from 'ant-design-vue';

import { useModalStore } from '@stores/useModal';
import { useProject } from '@stores/useProject';
import { useNeedReloadStore } from '@stores/useNeedReload';
const needReloadStore = useNeedReloadStore();
const modalStore = useModalStore();
const projectStore = useProject();
const { projects: recentProjects } = storeToRefs(projectStore);

const router = useRouter()
const projectId = ref('');
const projectName = ref('');
const activeCategoryCode = ref('all')
const activeSubCategoryCode = ref<string | null>(null)
type InspirationMediaType = 'image' | 'video' | 'unknown'
type HomeInspiration = {
  id: string
  coverUrl: string
  authorName: string
  viewCount: number
  likeCount: number
  imageHeight?: number
  title?: string
  mediaType?: InspirationMediaType
  favorited?: boolean
}
const inspirations = ref<HomeInspiration[]>([]);
const open = ref(false);
const visable = ref(false);
const inspirationsInfo = ref<any>({});
const inspirationColumnCount = ref(4);

const inspirationColumns = computed(() => {
  const count = Math.max(1, inspirationColumnCount.value);
  const columns: HomeInspiration[][] = Array.from({ length: count }, () => []);

  inspirations.value.forEach((item, index) => {
    columns[index % count]?.push(item);
  });

  return columns;
});

function updateInspirationColumnCount() {
  const width = window.innerWidth;

  if (width <= 640) {
    inspirationColumnCount.value = 1;
    return;
  }

  if (width <= 960) {
    inspirationColumnCount.value = 2;
    return;
  }

  if (width <= 1280) {
    inspirationColumnCount.value = 3;
    return;
  }

  inspirationColumnCount.value = 4;
}

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

function getNextUntitledProjectTitle() {
  const usedNumbers = new Set<number>()
  const pattern = /^未命名-(\d+)$/

  for (const project of recentProjects.value) {
    const match = project.title?.match(pattern)
    if (match) {
      usedNumbers.add(Number(match[1]))
    }
  }

  let index = 0
  while (usedNumbers.has(index)) {
    index += 1
  }

  return `未命名-${index}`
}

function openNewProject() {
  api.createProject({ title: getNextUntitledProjectTitle() }).then((res: any) => {
    router.push({ name: 'createProject', params: { id: res.id } })
  })
}

function onShowDemo() {
  visable.value = true;
}

function openProject(id: string) {
  router.push({ name: 'projectDetail', params: { id } })
}

const openInspiration = (item: any) => {
  console.log(item)
  inspirationsInfo.value = item;
  open.value = true;
  // router.push({ name: 'projectDetail', params: { id } })
}

const onLoadProjects = () => {
  needReloadStore.setNeedReload(false);
  return projectStore.loadProjects({ page: 1, pageSize: 10 })
}

const openUpdateProjectName = (id: string, name: string) => {
  projectId.value = id;
  projectName.value = name;
  modalStore.openModal('updateProjectName')
}

/**
 * Refresh projects list
 */
const onRefreshProjects = () => {
  onLoadProjects();
}

/**
 * Open delete project modal
 * @param id Project id
 */
const openDeleteProject = (id: string) => {
  Modal.confirm({
    title: '确定要删除此项目吗？',
    icon: createVNode(ExclamationCircleFilled),
    content: '删除后将无法恢复，请谨慎操作。',
    onOk() {
      return api.deleteProject(id).then(() => {
        onRefreshProjects()
      })
    },
  })
}

const onFavorite = (id: string, favorited: boolean) => {
  if (favorited) {
    api.unfavoriteInspiration(id).then(() => {
      message.success('已取消收藏')
      void onLoadHomeData();
    })
  } else {
    api.favoriteInspiration(id).then(() => {
      message.success('收藏成功')
      void onLoadHomeData();
    })
  }
}

const inspirationCategories = ref<HomeInspirationCategoryItem[]>([]);

const activeSubCategories = computed(() => {
  const primary = inspirationCategories.value.find(
    (category) => category.code === activeCategoryCode.value,
  )
  return primary?.children ?? []
})

function getEffectiveCategoryCode(): string | undefined {
  if (activeSubCategoryCode.value) return activeSubCategoryCode.value
  if (activeCategoryCode.value && activeCategoryCode.value !== 'all') {
    return activeCategoryCode.value
  }
  return undefined
}

function selectPrimaryCategory(category: HomeInspirationCategoryItem) {
  activeCategoryCode.value = category.code
  if (category.children?.length) {
    activeSubCategoryCode.value = category.children[0].code
  } else {
    activeSubCategoryCode.value = null
  }
}

function selectSubCategory(code: string) {
  activeSubCategoryCode.value = code
}

function applyInspirationsList(list: HomeInspiration[]) {
  attachInspirationMediaTypes(list)
  inspirations.value = list
}

async function loadInspirations(categoryCode?: string) {
  const res = await api.getHome<any>(categoryCode)
  applyInspirationsList((res.inspirations ?? []) as HomeInspiration[])
}

function guessMediaTypeFromUrl(url: string): InspirationMediaType {
  const lower = url.toLowerCase()
  const path = lower.split('?')[0] ?? ''

  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(path)) return 'video'
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/i.test(path)) return 'image'

  // 常见无扩展名图片 CDN / 占位图服务
  if (
    lower.includes('picsum.photos')
    || lower.includes('placehold.co')
    || lower.includes('placeholder.com')
    || lower.includes('images.unsplash.com')
    || /\/image\//.test(lower)
  ) {
    return 'image'
  }

  // 封面地址默认按图片展示，避免对不支持 HEAD 的 CDN 发探测请求
  return 'image'
}

function getMediaType(url: string): InspirationMediaType {
  if (!url.trim()) return 'unknown'
  return guessMediaTypeFromUrl(url)
}

function attachInspirationMediaTypes(items: HomeInspiration[]) {
  items.forEach((item) => {
    item.mediaType = getMediaType(item.coverUrl)
  })
}

const onLoadHomeData = async () => {
  const res = await api.getHome<any>()
  inspirationCategories.value = res.inspirationCategories ?? []
  applyInspirationsList((res.inspirations ?? []) as HomeInspiration[])
}

watch([activeCategoryCode, activeSubCategoryCode], () => {
  void loadInspirations(getEffectiveCategoryCode())
})

watch(needReloadStore.getNeedReload, (newVal) => {
  if (newVal) {
    onLoadProjects();
  }
})

onMounted(() => {
  updateInspirationColumnCount();
  window.addEventListener('resize', updateInspirationColumnCount);
  onLoadProjects();
  void onLoadHomeData();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateInspirationColumnCount);
});

</script>
<style>

</style>
<style scoped lang="scss">
@import './index.scss';
</style>
