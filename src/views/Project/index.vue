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
        <div v-if="list.length > 0" class="project-panel__grid">
          <button
            type="button"
            class="project-card project-card--upload"
            @click="triggerUpload"
            v-if="scope === 'FILES'"
          >
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
            v-for="file in list"
            :key="file.id"
            type="button"
            class="project-card"
            :class="`project-card--${file.type}`"
          >
            <img
              class="project-card__image"
              :src="file.previewUrl"
              alt=""
              loading="lazy"
            />
          </button>
        </div>
        <div v-else class="project-panel__empty">
          <p>暂无内容</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PROJECT_TABS, type ProjectFileItem } from './projectData'
import api from '@/services/api';

const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<ProjectFileItem[]>([])
const scope = ref('RECOMMENDED');
const page = ref(1);
const list = ref<any[]>([]);

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

const onChangeScope = (key: string) => {
  scope.value = key;
  page.value = 1;
  onLoadAssets();
}

const onLoadAssets = () => {
  api.getAssets({
    scope: scope.value,
    pageSize: 50,
    page: 1,
  }).then((res: any) => {
    console.log('res', res);
    list.value = res.records;
  })
}

onMounted(()=>{
  onLoadAssets();
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
