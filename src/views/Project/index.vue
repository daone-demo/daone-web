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
    <section class="home__section home__section--inspiration" v-if="scope === 'CENTER'">
      <div class="home__filters">
        <button
          v-for="category in materialCategories"
          :key="category.code"
          type="button"
          class="home__filter-btn"
          :class="{ 'home__filter-btn--active': activeCategoryCode === category.code }"
          @click="selectPrimaryCategory(category.code)"
        >
          {{ category.name }}
        </button>
      </div>

      <div
        v-if="materialSubCategories.length > 0"
        class="home__filters home__filters--sub"
      >
        <button
          v-for="subCategory in materialSubCategories"
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
                <span class="home__inspiration-name">{{ item.authorName }}</span>
              </div>
              <div class="home__inspiration-stats">
                <span class="home__inspiration-stat">
                  <span class="home__inspiration-stat-icon home__inspiration-stat-icon--view" aria-hidden="true" />
                  {{ formatCount(item.viewCount) }}
                </span>
                <span class="home__inspiration-stat">
                  <span class="home__inspiration-stat-icon home__inspiration-stat-icon--like" aria-hidden="true" />
                  {{ formatCount(item.likeCount) }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
    <section class="project-panel" v-else>
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
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { PROJECT_TABS, type ProjectFileItem } from './projectData';
import EmbeddedVideoPlayer from '@components/EmbeddedVideoPlayer/index.vue';
import { Modal } from 'ant-design-vue';
import api from '@/services/api';

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

const uploadInputRef = ref<HTMLInputElement | null>(null)
const uploadedFiles = ref<ProjectFileItem[]>([])
const scope = ref('CENTER');
const page = ref(1);
const list = ref<any[]>([]);
const materialCategories = ref<any[]>([]);
const activeCategoryCode = ref('');
const materialSubCategories = ref<any[]>([]);
const activeSubCategoryCode = ref('');
const open = ref(false);
const inspirationsInfo = ref<any>({});
const inspirationColumnCount = ref(4);
const inspirations = ref<any[]>([]);

const inspirationColumns = computed(() => {
  const count = Math.max(1, inspirationColumnCount.value);
  const columns: HomeInspiration[][] = Array.from({ length: count }, () => []);

  inspirations.value.forEach((item, index) => {
    columns[index % count]?.push(item);
  });
  return columns;
});

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
  if (scope.value === 'CENTER') {
    
  }
  else {
    onLoadAssets();
  }
}

const onLoadMaterialCategories = () => {
  api.queryMaterialCategories().then((res: any) => {
    materialCategories.value = res;
    console.log('res', res);
  })
}

const onLoadAssets = () => {
  api.getAssets({
    scope: scope.value,
    pageSize: 50,
    page: 1,
  }).then((res: any) => {
    // console.log('res', res);
    list.value = res.records;
  })
}

const selectPrimaryCategory = (code: string) => {
  activeCategoryCode.value = code;
  materialSubCategories.value = materialCategories.value.find((item: any) => item.code === code)?.children ?? [];
}

const selectSubCategory = (code: string) => {
  activeSubCategoryCode.value = code;
  onLoadAssets();
}

const openInspiration = (item: any) => {
  console.log(item)
  inspirationsInfo.value = item;
  open.value = true;
}

onMounted(()=>{
  onLoadMaterialCategories();
  onLoadAssets();
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
