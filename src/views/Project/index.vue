<template>
  <div class="project-page">
    <header class="project-panel__header">
      <nav class="project-panel__tabs" aria-label="素材分类">
        <button
          v-for="tab in PROJECT_TABS"
          :key="tab.key"
          type="button"
          class="project-panel__tab"
          :class="{ 'project-panel__tab--active': scope === tab.key }"
          @click="onChangeScope(tab.key)"
        >
          {{ tab.label }}
          <img
            v-if="userInfoStore.userInfo?.isVip && tab.key === 'CENTER'"
            src="@/assets/images/vip.svg"
            class="project-panel__tab_icon"
          />
        </button>
      </nav>
    </header>

    <MaterialAssetsContent
      :scope="scope"
      :use-window-scroll="true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PROJECT_TABS, type ProjectTabKey } from './projectData'
import MaterialAssetsContent from './MaterialAssetsContent.vue';
import { useUserInfo } from '@/stores/useUserInfo'
const userInfoStore = useUserInfo();
const scope = ref<ProjectTabKey>('CENTER')

function onChangeScope(key: ProjectTabKey) {
  scope.value = key
}
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
