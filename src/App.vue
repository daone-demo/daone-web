<template>
  <div class="app-shell">
    <div class="app-navBar">
      <!-- <img src="@assets/images/logo_black.png" alt="Daone" class="app-navBar-logo" /> -->
      <nav class="app-sidebar" v-if="showNav" aria-label="主导航">
        <a-popover placement="right">
          <template #content>
            <span>新建项目</span>
          </template>
          <button 
            type="button"
            class="app-sidebar__btn app-sidebar__btn--primary"
            title="新建"
            @click="onDoAction('createProject')"
          >
            <span class="app-sidebar__icon app-sidebar__icon--plus" aria-hidden="true" />
          </button>
        </a-popover>
        <a-popover placement="right">
          <template #content>
            <span>首页</span>
          </template>
          <button
            type="button"
            class="app-sidebar__btn"
            :class="{ 'app-sidebar__btn--active': route.name === 'home' }"
            title="首页"
            @click="goHome"
          >
            <span class="app-sidebar__icon app-sidebar__icon--home" aria-hidden="true" />
          </button>
        </a-popover>
        <a-popover placement="right">
          <template #content>
            <span>项目</span>
          </template>
          <button
            type="button"
            class="app-sidebar__btn"
            :class="{ 'app-sidebar__btn--active': route.name === 'project' }"
            title="项目"
            @click="onDoAction('project')"
          >
            <span class="app-sidebar__icon app-sidebar__icon--folder" aria-hidden="true" />
          </button>
        </a-popover>
        <a-popover placement="right">
          <template #content>
            <span>个人主页</span>
          </template>
          <button 
            type="button"
            class="app-sidebar__btn"
            :class="{ 'app-sidebar__btn--active': route.name === 'userInfo' }"
            title="个人主页"
            @click="onDoAction('userInfo')"
          >
            <!-- <span class="app-sidebar__icon app-sidebar__icon--user" aria-hidden="true" /> -->
            <i class="iconfont icon-user" style="font-size: 18px;" />
          </button>
        </a-popover>
        <a-popover placement="right">
          <template #content>
            <a-flex justify="space-between">
              <div class="protocol-link">用户协议</div>
            </a-flex>
            <a-flex justify="space-between">
              <div class="protocol-link">隐私政策</div>
            </a-flex>
            <a-flex justify="space-between">
              <a-button type="primary" @click="openLoginModal">登录</a-button>
            </a-flex>
            <img
              src="@assets/images/kefu.jpg"
              class="app-sidebar__kefu"
            />
          </template>
          <button type="button" class="app-sidebar__btn" title="帮助">
            <i class="iconfont icon-info-circle" style="font-size: 18px;" />
          </button>
        </a-popover>
      </nav>
    </div>
    <main class="app-main">
      <router-view />
    </main>
    <Login v-model:open="modalStore.loginVisible" />
    <Combo v-model:open="modalStore.comboVisible" />
  </div>
</template>

<script setup lang="ts">
import Combo from '@components/Combo/index.vue';
import { useModalStore } from '@stores/useModal';
import Login from '@components/Login/index.vue';

import { useRoute, useRouter } from 'vue-router';
import { nextTick, onMounted, onUnmounted, watch, ref } from 'vue';
import api from '@/services/api';
import { bindOnUnauthorized, resetAuthRedirecting, unbindOnUnauthorized } from '@/utils/request';

const modalStore = useModalStore()
const showNav = ref(true)

const route = useRoute()
const router = useRouter()

function openLoginModal() {
  modalStore.openModal('login')
}

onMounted(() => {
  bindOnUnauthorized(openLoginModal)
})

onUnmounted(() => {
  unbindOnUnauthorized()
})

watch(
  () => modalStore.loginVisible,
  (visible) => {
    if (!visible) {
      resetAuthRedirecting()
    }
  },
)

const onDoAction = (key: string) => {
  api.getCurrentUser()
    .then((res: any) => {
      if (res.id) {
        if (key=== 'createProject') {
          api.createProject({ title: `新项目-${Date.now()}` }).then((res: any) => {
            router.push({ name: 'createProject', params: { id: res.id } })
          })
        }
        else {
          router.push({ name: key })
        }
      } else {
        openLoginModal()
      }
    })
    .catch(() => {
      // 401 时 request 拦截器已通过 bindOnUnauthorized 打开登录弹窗
    })
}

watch(
  () => route.name,
  (name) => {
    showNav.value = name !== 'createProject' && name !== 'projectDetail'
  },
  { immediate: true },
)

async function goHome() {
  if (route.name !== 'home') {
    await router.push({ name: 'home' })
  }
  await nextTick()
  scrollPageToTop()
}

function scrollPageToTop() {
  document.querySelector('.home')?.scrollTo({ top: 0, behavior: 'smooth' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style scoped lang="scss">
.app-shell {
  position: relative;
  width: 100%;
  min-height: 100svh;
}

.app-main {
  width: 100%;
  min-height: 100svh;
}
.app-navBar {
  position: fixed;
  top: 50%;
  left: 20px;
  z-index: 20;
  transform: translateY(-50%);
}
.app-navBar-logo {
  width: 48px;
  height: auto;
  border-radius: 100%;
  margin-bottom: 15px;
  margin-left: 5px;
}
.app-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  background: rgba(248, 249, 250, 0.96);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  
}

.app-sidebar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.06);
  }

  &--active {
    background: rgba(15, 23, 42, 0.08);
  }

  &--primary {
    background: #111827;
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.24);

    &:hover {
      background: #1f2937;
    }
  }
}

.app-sidebar__icon {
  display: block;
  width: 20px;
  height: 20px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.app-sidebar__icon--plus {
  width: 18px;
  height: 18px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.4' stroke-linecap='round'%3E%3Cline x1='12' y1='5' x2='12' y2='19'/%3E%3Cline x1='5' y1='12' x2='19' y2='12'/%3E%3C/svg%3E");
}

.app-sidebar__icon--home {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10.5 12 3l9 7.5'/%3E%3Cpath d='M5 9.5V20h14V9.5'/%3E%3Cpath d='M10 20v-6h4v6'/%3E%3C/svg%3E");
}

.app-sidebar__icon--folder {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7.5h6l1.5 2H20a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z'/%3E%3C/svg%3E");
}

.app-sidebar__icon--user {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='3.5'/%3E%3Cpath d='M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6'/%3E%3C/svg%3E");
}

.app-sidebar__icon--info {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23374151' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cline x1='12' y1='11' x2='12' y2='16'/%3E%3Ccircle cx='12' cy='8' r='0.8' fill='%23374151' stroke='none'/%3E%3C/svg%3E");
}
.app-sidebar__kefu {
  width: 150px;
  height: auto;
}
.protocol-link {
  height: 48px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #111827;
}
</style>
