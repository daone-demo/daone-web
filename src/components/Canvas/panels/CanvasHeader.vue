<template>
  <header class="canvas__header">
    <div :class="`canvas__brand ${canvasBgTheme === 'light' ? 'bg_white' : ''}`">
      <img
        :src="canvasBgTheme === 'light' ? logoBlack : logoWhite"
        class="canvas__brand-magic"
        @click="emit('go-home')"
      />
      <div class="canvas__brand-project-wrap">
        <button
          type="button"
          class="canvas__brand-project"
          :class="{ 'canvas__brand-project--active': showProjectMenu }"
          @click="emit('toggle-project-menu')"
        >
          <span class="canvas__brand-project-name">{{ displayProjectName }}</span>
          <span class="canvas__brand-project-arrow" aria-hidden="true" />
        </button>
        <div
          v-if="showProjectMenu"
          class="canvas__project-menu"
          @mousedown.stop
        >
          <div class="canvas__project-menu-head">
            <span class="canvas__project-menu-title">我的创作</span>
            <div class="canvas__project-menu-legend">
              <span class="canvas__project-menu-legend-item">
                <i class="canvas__project-status canvas__project-status--saved" aria-hidden="true" />
                已存
              </span>
              <span class="canvas__project-menu-legend-item">
                <i class="canvas__project-status canvas__project-status--unsaved" aria-hidden="true" />
                未存
              </span>
            </div>
          </div>
          <button
            v-for="project in projects"
            :key="project.id"
            type="button"
            class="canvas__project-item"
            :class="{ 'canvas__project-item--active': project.id === activeProjectId }"
            @click="emit('select-project', project.id)"
          >
            <span
              class="canvas__project-doc"
              :class="{ 'canvas__project-doc--active': project.id === activeProjectId }"
              aria-hidden="true"
            />
            <!-- <i
              class="canvas__project-status"
              :class="project.saved ? 'canvas__project-status--saved' : 'canvas__project-status--unsaved'"
              aria-hidden="true"
            /> -->
            <span class="canvas__project-name">{{ project.title }}</span>
            <i
              class="iconfont icon-zhongmingming"
              @click.stop="emit('rename-project', project.id, project.title)"
            />
            <i
              class="iconfont icon-shanchu1"
              v-if="project.id !== activeProjectId"
              @click.stop="emit('delete-project', project.id)"
            />
            <span
              v-if="project.id === activeProjectId"
              class="canvas__project-check"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      <button
        type="button"
        class="canvas__brand-add"
        title="新建"
        @click="emit('new-project')"
      >
        +
      </button>
      <span class="canvas__brand-divider" aria-hidden="true" />
      <div class="canvas__brand-group">
        <button
          type="button"
          class="canvas__brand-icon-btn"
          title="撤销"
          :disabled="!canUndo"
          @click="emit('undo')"
        >
          <i class="iconfont icon-shangyibu"></i>
        </button>
        <button
          type="button"
          class="canvas__brand-icon-btn"
          title="重做"
          :disabled="!canRedo"
          @click="emit('redo')"
        >
          <i class="iconfont icon-xiayibu"></i>
        </button>
      </div>
      <span class="canvas__brand-divider" aria-hidden="true" />
      <div class="canvas__brand-group">
        <button type="button" class="canvas__brand-icon-btn" title="保存（每 8 秒自动保存）" @click="emit('save')">
          <i class="iconfont icon-baocun" style="font-size: 18px;"></i>
        </button>
        <button type="button" class="canvas__brand-icon-btn" title="打开文件夹">
          <span class="canvas__brand-icon canvas__brand-icon--folder" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div class="canvas__header-actions">
      <button type="button" class="canvas__header-pill" @click="emit('export')">
        <span class="canvas__header-pill-icon canvas__header-pill-icon--share" aria-hidden="true" />
        导出
      </button>
      <div class="canvas__header-user-wrap">
        <button
          type="button"
          class="canvas__header-pill canvas__header-pill--credits"
          :class="{ 'canvas__header-pill--active': showUserMenu }"
          @click="emit('toggle-user-menu')"
        >
          <img
            v-if="userInfoStore.userInfo?.avatarUrl"
            :src="userInfoStore.userInfo?.avatarUrl ?? ''"
            class="canvas__header-avatar"
            aria-hidden="true"
          />
          <span
            class="canvas__header-pill-icon canvas__header-pill-icon--star"
            aria-hidden="true"
            v-else
          />
          <span class="canvas__header-credits-value">{{ userInfoStore?.pointAccount?.available || 0 }}</span>
          <span class="canvas__header-avatar" aria-hidden="true" />
        </button>

        <div v-if="showUserMenu" class="canvas__user-menu" @mousedown.stop>
          <button type="button" class="canvas__user-menu-profile" @click="emit('go-user-center')">
            <img
              v-if="userInfoStore.userInfo?.avatarUrl"
              :src="userInfoStore.userInfo?.avatarUrl ?? ''"
              class="canvas__header-avatar"
              aria-hidden="true"
            />
            <span class="canvas__user-menu-avatar" aria-hidden="true"  v-else />
            <span class="canvas__user-menu-profile-main">
              <span class="canvas__user-menu-name">{{ userInfoStore.userInfo?.nickname }}</span>
              <span class="canvas__user-menu-badge">
                <span class="canvas__user-menu-vip" aria-hidden="true">VIP</span>
                {{ userRole }}
              </span>
            </span>
            <span class="canvas__user-menu-chevron" aria-hidden="true" />
          </button>

          <div class="canvas__user-menu-balance">
            <span class="canvas__user-menu-balance-left">
              <span class="canvas__user-menu-balance-icon" aria-hidden="true" />
              <span class="canvas__user-menu-balance-value">{{ userInfoStore?.pointAccount?.available || 0 }}</span>
            </span>
            <button type="button" class="canvas__user-menu-buy" @click="emit('open-combo')">
              购买
            </button>
          </div>

          <nav class="canvas__user-menu-nav" aria-label="用户菜单">
            <button
              v-for="item in USER_MENU_ITEMS"
              :key="item.key"
              type="button"
              class="canvas__user-menu-item"
              @click="emit('user-menu-action', item.key)"
            >
              <span
                class="canvas__user-menu-item-icon"
                :class="`canvas__user-menu-item-icon--${item.key}`"
                aria-hidden="true"
              />
              <span>{{ item.label }}</span>
            </button>
          </nav>

          <div class="canvas__user-menu-divider" aria-hidden="true" />

          <button type="button" class="canvas__user-menu-logout" @click="emit('logout')">
            <span class="canvas__user-menu-logout-icon" aria-hidden="true" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import logoWhite from '@assets/images/logo_white.png'
import logoBlack from '@assets/images/logo_black.png'
import type { CanvasBgTheme } from '../canvasTheme';
import { useUserInfo } from '@/stores/useUserInfo';
import { useRouter } from 'vue-router';

const router = useRouter();
const userInfoStore = useUserInfo();

export type CanvasProjectItem = {
  id: string
  title: string
  coverAssetId: string | null
  coverUrl: string | null
  revision: number
  createdAt: string
  updatedAt: string
}

const USER_MENU_ITEMS = [
  { key: 'assets', label: '账户管理' },
  { key: 'UserAgreement', label: '用户协议' },
  { key: 'PrivacyPolicy', label: '隐私政策' },
] as const

export type UserMenuKey = (typeof USER_MENU_ITEMS)[number]['key']

const props = defineProps<{
  canvasBgTheme: CanvasBgTheme
  currentProjectName: string
  canUndo: boolean
  canRedo: boolean
  credits: number
  showProjectMenu: boolean
  showUserMenu: boolean
  projects: CanvasProjectItem[]
  activeProjectId: string
  userName: string
  userRole: string
  userPoints: number
}>()

const displayProjectName = computed(
  () => props.projects.find((project) => project.id === props.activeProjectId)?.title
    ?? props.currentProjectName
    ?? '未命名创作',
)

const emit = defineEmits<{
  'go-home': []
  'toggle-project-menu': []
  'select-project': [projectId: string]
  undo: []
  redo: []
  save: []
  export: []
  'toggle-user-menu': []
  'go-user-center': []
  'open-combo': []
  'user-menu-action': [key: UserMenuKey]
  logout: []
  'new-project': [],
  'rename-project': [projectId: string, name: string],
  'delete-project': [projectId: string],
}>();

</script>
