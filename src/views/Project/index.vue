<template>
  <div class="project-page">
    <header class="project-panel__header">
        <nav class="project-panel__tabs" aria-label="素材分类">
          <button
            v-for="tab in PROJECT_TABS"
            :key="tab.key"
            type="button"
            class="project-panel__tab"
            :class="{ 'project-panel__tab--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <!-- <div class="project-panel__actions">
          <span class="project-panel__hint">画布和企业版页面上传图片</span>
          <button type="button" class="project-panel__close" title="关闭" @click="goBack">
            <span aria-hidden="true">×</span>
          </button>
        </div> -->
    </header>
    <section class="project-panel">
      <div class="project-panel__body">
        <div v-if="activeTab === 'recommend'" class="project-panel__grid">
          <button
            v-for="file in displayFiles"
            :key="file.id"
            type="button"
            class="project-card"
            :class="`project-card--${file.type}`"
          >
            <img
              v-if="file.type === 'image' && file.image"
              class="project-card__image"
              :src="file.image"
              alt=""
              loading="lazy"
            />
            <span v-else-if="file.type === 'scribble'" class="project-card__scribble" aria-hidden="true" />
            <span v-else-if="file.type === 'green'" class="project-card__green" aria-hidden="true" />
          </button>
        </div>
        <div v-if="activeTab === 'material'" class="project-panel__grid">
          <button
            v-for="file in displayFiles"
            :key="file.id"
            type="button"
            class="project-card"
            :class="`project-card--${file.type}`"
          >
            <img
              v-if="file.type === 'image' && file.image"
              class="project-card__image"
              :src="file.image"
              alt=""
              loading="lazy"
            />
            <span v-else-if="file.type === 'scribble'" class="project-card__scribble" aria-hidden="true" />
            <span v-else-if="file.type === 'green'" class="project-card__green" aria-hidden="true" />
          </button>
        </div>
        <div v-if="activeTab === 'files'" class="project-panel__grid">
          <button type="button" class="project-card project-card--upload" @click="triggerUpload">
            <span class="project-card__upload-icon" aria-hidden="true">+</span>
            <span class="project-card__upload-label">上传图片</span>
            <input
              ref="uploadInputRef"
              class="project-card__upload-input"
              type="file"
              accept="image/*"
              multiple
              @change="handleUploadChange"
            />
          </button>
          <button
            v-for="file in displayFiles"
            :key="file.id"
            type="button"
            class="project-card"
            :class="`project-card--${file.type}`"
          >
            <img
              v-if="file.type === 'image' && file.image"
              class="project-card__image"
              :src="file.image"
              alt=""
              loading="lazy"
            />
            <span v-else-if="file.type === 'scribble'" class="project-card__scribble" aria-hidden="true" />
            <span v-else-if="file.type === 'green'" class="project-card__green" aria-hidden="true" />
          </button>
        </div>
        <div v-else class="project-panel__empty">
          <p>{{ emptyTabText }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { PROJECT_FILES, PROJECT_TABS, type ProjectFileItem, type ProjectTabKey } from './projectData'

const activeTab = ref<ProjectTabKey>('files')
const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<ProjectFileItem[]>([])

const displayFiles = computed(() => [...uploadedFiles.value, ...PROJECT_FILES])

const emptyTabText = computed(() => {
  const tab = PROJECT_TABS.find((item) => item.key === activeTab.value)
  return tab ? `${tab.label}内容即将上线` : '暂无内容'
})

function triggerUpload() {
  uploadInputRef.value?.click()
}

function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return

  uploadedFiles.value = files.map((file, index) => ({
    id: `upload-${file.name}-${index}-${Date.now()}`,
    type: 'image' as const,
    image: URL.createObjectURL(file),
  }))

  input.value = ''
}
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
