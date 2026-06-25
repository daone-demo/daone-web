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
            <a-button type="default" class="home__hero-voideo" @click="openNewProject">查看演示</a-button>
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
            <span class="home__project-cover" aria-hidden="true" />
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
            :class="{ 'home__filter-btn--active': activeCategory === category.code }"
            @click="activeCategory = category.code"
          >
            {{ category.name }}
          </button>
        </div>

        <div class="home__inspiration-grid">
          <article
            v-for="item in filteredInspiration"
            :key="item.id"
            class="home__inspiration-card"
            @click="openInspiration(item.id)"
          >
            <div class="home__inspiration-media">
              <img
                class="home__inspiration-image"
                :src="item.image"
                :alt="`${item.author} 的作品`"
                loading="lazy"
                :style="{ height: `${item.imageHeight}px` }"
              />
            </div>
            <div class="home__inspiration-footer">
              <div class="home__inspiration-author">
                <img class="home__inspiration-avatar" :src="item.avatar" :alt="item.author" loading="lazy" />
                <span class="home__inspiration-name">{{ item.author }}</span>
              </div>
              <div class="home__inspiration-stats">
                <span class="home__inspiration-stat">
                  <span class="home__inspiration-stat-icon home__inspiration-stat-icon--view" aria-hidden="true" />
                  {{ formatCount(item.views) }}
                </span>
                <span class="home__inspiration-stat">
                  <span class="home__inspiration-stat-icon home__inspiration-stat-icon--like" aria-hidden="true" />
                  {{ formatCount(item.likes) }}
                </span>
              </div>
            </div>
          </article>
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
</template>

<script setup lang="ts">
import { ExclamationCircleFilled, MoreOutlined } from '@ant-design/icons-vue'
import { computed, createVNode, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import api from '@/services/api';
import {
  HOME_INSPIRATION_ITEMS,
  type HomeInspirationCategory,
} from './homeData'
import dayjs from 'dayjs';
import UpdateProjectName from '@components/UpdateProjectName/index.vue';
import { Modal } from 'ant-design-vue';

import { useModalStore } from '@stores/useModal';
import { useProject } from '@stores/useProject';
const modalStore = useModalStore();
const projectStore = useProject();
const { projects: recentProjects } = storeToRefs(projectStore);

const router = useRouter()
const projectId = ref('');
const projectName = ref('');
const activeCategory = ref<HomeInspirationCategory>('all')

const filteredInspiration = computed(() => {
  if (activeCategory.value === 'all') {
    return HOME_INSPIRATION_ITEMS
  }
  return HOME_INSPIRATION_ITEMS.filter((item) => item.category === activeCategory.value)
})

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

function openNewProject() {
  api.createProject({ title: `新项目-${Date.now()}` }).then((res: any) => {
    router.push({ name: 'createProject', params: { id: res.id } })
  })
}

function openProject(id: string) {
  router.push({ name: 'projectDetail', params: { id } })
}

const openInspiration = (id: string) => {
  router.push({ name: 'projectDetail', params: { id } })
}

const onLoadProjects = () => {
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

const inspirationCategories = ref<any[]>([]);

const onLoadHomeData = () => {
  api.getHome()
    .then((res:any)=>{
      console.log('onLoadHomeData', res)
      inspirationCategories.value = res.inspirationCategories;
    })
}

onMounted(()=>{
  onLoadProjects();
  onLoadHomeData();
});

</script>

<style scoped lang="scss">
@import './index.scss';
</style>
