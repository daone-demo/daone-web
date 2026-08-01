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

      <div
        ref="materialGridRef"
        class="home__inspiration-grid"
        @scroll.passive="onMaterialGridScroll"
      >
        <div
          v-for="(column, columnIndex) in materialColumns"
          :key="columnIndex"
          class="home__inspiration-column"
        >
          <article
            v-for="item in column"
            :key="item.id"
            class="home__inspiration-card"
            @click.stop="openInspiration(item)"
          >
            <div
              class="home__inspiration-media"
              :class="{ 'home__inspiration-media--video': item.type === 'VIDEO' }"
            >
              <img
                v-if="item.type === 'IMAGE'"
                class="home__inspiration-image"
                :src="item.resourceUrl"
                :alt="item.title || '素材'"
                loading="lazy"
              />
              <EmbeddedVideoPlayer
                v-else-if="item.type === 'VIDEO'"
                :src="item.resourceUrl"
                preview
              />
            </div>
          </article>
        </div>
      </div>
      <p v-if="materialLoading" class="project-material__loading">加载中...</p>
      <p v-else-if="!materialHasMore && materialList.length" class="project-material__end">没有更多了</p>
      <p v-else-if="!materialLoading && !materialList.length" class="project-material__empty">暂无素材</p>
    </section>
    <section class="project-panel" v-else>
      <div class="project-panel__body">
        <input
          ref="uploadInputRef"
          class="project-card__upload-input"
          type="file"
          accept="image/*"
          multiple
          @change="handleUploadChange"
        />
        <div
          ref="assetGridRef"
          class="home__inspiration-grid"
          @scroll.passive="onAssetGridScroll"
        >
          <div
            v-for="(column, columnIndex) in assetColumns"
            :key="columnIndex"
            class="home__inspiration-column"
          >
            <button
              v-if="columnIndex === 0 && showAssetUpload"
              type="button"
              class="project-panel__upload-card"
              @click="triggerUpload"
            >
              <span class="project-card__upload-icon" aria-hidden="true">+</span>
              <span class="project-card__upload-label">上传图片</span>
            </button>
            <article
              v-for="item in column"
              :key="item.id"
              class="home__inspiration-card"
              @click="openFile(item)"
            >
              <div
                class="home__inspiration-media"
                :class="{ 'home__inspiration-media--video': isVideoAsset(item) }"
              >
                <img
                  v-if="!isVideoAsset(item)"
                  class="home__inspiration-image"
                  :src="resolveAssetMediaUrl(item)"
                  :alt="resolveAssetTitle(item)"
                  loading="lazy"
                />
                <template v-else>
                  <video
                    class="home__inspiration-image home__inspiration-video-thumb"
                    :src="resolveAssetMediaUrl(item)"
                    muted
                    playsinline
                    preload="metadata"
                  />
                  <span class="home__inspiration-video-play" aria-hidden="true" />
                </template>
              </div>
            </article>
          </div>
        </div>

        <p v-if="assetLoading" class="project-material__loading">加载中...</p>
        <p v-else-if="!assetHasMore && assetList.length" class="project-material__end">没有更多了</p>
        <p v-else-if="!assetLoading && !assetList.length && !showAssetUpload" class="project-material__empty">暂无内容</p>
      </div>
    </section>
  </div>
  <a-modal 
    v-model:open="open"
    width="800px"
    class="home__inspiration-modal"
  >
    <img
      v-if="inspirationsInfo.type === 'IMAGE'"
      :src="inspirationsInfo.resourceUrl"
      :alt="inspirationsInfo.title"
      style="width: 100%; height: 100%;"
    />
    <EmbeddedVideoPlayer
      v-if="inspirationsInfo.type === 'VIDEO'"
      :src="inspirationsInfo.resourceUrl"
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
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { PROJECT_TABS, type ProjectFileItem } from './projectData';
import EmbeddedVideoPlayer from '@components/EmbeddedVideoPlayer/index.vue';
import api from '@/services/api';

const MATERIAL_COLUMN_COUNT = 6
const MATERIAL_PAGE_SIZE = 30
const SCROLL_LOAD_THRESHOLD = 120

type MaterialItem = {
  id: string
  type: 'IMAGE' | 'VIDEO'
  resourceUrl?: string
  coverUrl?: string
  title?: string
  authorName?: string
}

type AssetItem = {
  id: string
  previewUrl?: string
  url?: string
  fileName?: string
  name?: string
  type?: string
}

function isVideoAsset(item: Pick<AssetItem, 'type'>): boolean {
  return String(item.type ?? '').toUpperCase() === 'VIDEO'
}

function resolveAssetMediaUrl(item: AssetItem): string {
  if (isVideoAsset(item)) {
    return item.url || item.previewUrl || ''
  }
  return item.previewUrl || item.url || ''
}

function resolveAssetTitle(item: AssetItem): string {
  return item.fileName || item.name || '素材'
}

function normalizeAssetItem(item: AssetItem): AssetItem {
  const type = String(item.type ?? 'IMAGE').toUpperCase()
  return {
    ...item,
    type,
    previewUrl: item.previewUrl || item.url || '',
    url: item.url || item.previewUrl || '',
  }
}

const uploadInputRef = ref<HTMLInputElement | null>(null)
const materialGridRef = ref<HTMLElement | null>(null)
const assetGridRef = ref<HTMLElement | null>(null)
const uploadedFiles = ref<ProjectFileItem[]>([])
const scope = ref('CENTER');
const assetList = ref<AssetItem[]>([]);
const assetPage = ref(1);
const assetHasMore = ref(true);
const assetLoading = ref(false);
const materialCategories = ref<any[]>([]);
const materialCode = ref('');
const activeCategoryCode = ref('');
const materialSubCategories = ref<any[]>([]);
const activeSubCategoryCode = ref('');
const open = ref(false);
const inspirationsInfo = ref<any>({});
const materialList = ref<MaterialItem[]>([]);
const materialPage = ref(1);
const materialHasMore = ref(true);
const materialLoading = ref(false);

const materialColumns = computed(() => {
  const columns: MaterialItem[][] = Array.from(
    { length: MATERIAL_COLUMN_COUNT },
    () => [],
  )

  materialList.value.forEach((item, index) => {
    columns[index % MATERIAL_COLUMN_COUNT]?.push(item)
  })

  return columns
})

const assetColumns = computed(() => {
  const columns: AssetItem[][] = Array.from(
    { length: MATERIAL_COLUMN_COUNT },
    () => [],
  )

  assetList.value.forEach((item, index) => {
    columns[index % MATERIAL_COLUMN_COUNT]?.push(item)
  })

  return columns
})

const showAssetUpload = computed(
  () => scope.value === 'FILES' || scope.value === 'MINE',
)

function resetMaterialList() {
  materialPage.value = 1
  materialHasMore.value = true
  materialList.value = []
}

function resetAssetList() {
  assetPage.value = 1
  assetHasMore.value = true
  assetList.value = []
}

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
  }));

  input.value = '';
}

const onChangeScope = (key: string) => {
  scope.value = key;
  if (scope.value === 'CENTER') {
    resetMaterialList()
    onLoadMaterialCategories();
  }
  else {
    resetAssetList()
    onLoadAssets();
  }
}

const onLoadMaterialCategories = () => {
  api.queryMaterialCategories().then((res: any) => {
    materialCategories.value = res;
    activeCategoryCode.value = res[0].code;
    materialSubCategories.value = materialCategories.value.find((item: any) => item.code === res[0].code)?.children ?? [];
    if (materialSubCategories.value.length > 0) {
      materialSubCategories.value.unshift({
        code: 'all',
        name: '全部',
      })
      activeSubCategoryCode.value = 'all';
      materialCode.value = activeCategoryCode.value;
    } else {
      materialCode.value = activeCategoryCode.value;
    }
    resetMaterialList()
    onLoadMaterials();
  })
}

const onLoadAssets = async () => {
  if (assetLoading.value || !assetHasMore.value) return
  assetLoading.value = true
  try {
    const res: any = await api.getAssets({
      scope: scope.value,
      pageSize: MATERIAL_PAGE_SIZE,
      page: assetPage.value,
    })
    const records = ((res.records ?? []) as AssetItem[]).map(normalizeAssetItem)
    const total = Number(res.total ?? records.length)

    if (assetPage.value === 1) {
      assetList.value = records
    } else {
      assetList.value = [...assetList.value, ...records]
    }

    assetPage.value += 1
    assetHasMore.value = assetList.value.length < total && records.length > 0
  } finally {
    assetLoading.value = false
  }
}

const selectPrimaryCategory = (code: string) => {
  activeCategoryCode.value = code;
  materialSubCategories.value = materialCategories.value.find((item: any) => item.code === code)?.children ?? [];
  if (materialSubCategories.value.length > 0) {
    materialSubCategories.value.unshift({
      code: 'all',
      name: '全部',
    })
    activeSubCategoryCode.value = 'all';
    materialCode.value = activeCategoryCode.value;
  } else {
    materialCode.value = activeCategoryCode.value;
  }
  resetMaterialList()
  onLoadMaterials();
}

const onLoadMaterials = async () => {
  if (materialLoading.value || !materialHasMore.value || !materialCode.value) return
  materialLoading.value = true
  try {
    const res: any = await api.queryMaterials({
      categoryCode: materialCode.value,
      pageSize: MATERIAL_PAGE_SIZE,
      page: materialPage.value,
    })
    const records = (Array.isArray(res) ? res : res.records ?? []) as MaterialItem[]
    const total = Array.isArray(res) ? records.length : Number(res.total ?? records.length)

    if (materialPage.value === 1) {
      materialList.value = records
    } else {
      materialList.value = [...materialList.value, ...records]
    }

    materialPage.value += 1
    materialHasMore.value =
      !Array.isArray(res)
      && materialList.value.length < total
      && records.length > 0
  } finally {
    materialLoading.value = false
  }
}

const selectSubCategory = (code: string) => {
  activeSubCategoryCode.value = code;
  materialCode.value = code === 'all' ? activeCategoryCode.value : code;
  resetMaterialList()
  onLoadMaterials();
}

function onAssetGridScroll(event: Event) {
  if (scope.value === 'CENTER' || assetLoading.value || !assetHasMore.value) return
  const el = event.target as HTMLElement
  if (!el) return
  const reachedBottom =
    el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD
  if (reachedBottom) {
    void onLoadAssets()
  }
}

function onMaterialGridScroll(event: Event) {
  if (scope.value !== 'CENTER' || materialLoading.value || !materialHasMore.value) return
  const el = event.target as HTMLElement
  if (!el) return
  const reachedBottom =
    el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD
  if (reachedBottom) {
    void onLoadMaterials()
  }
}

function onWindowScroll() {
  const reachedBottom =
    window.innerHeight + window.scrollY
    >= document.documentElement.scrollHeight - SCROLL_LOAD_THRESHOLD
  if (!reachedBottom) return

  if (scope.value === 'CENTER') {
    if (!materialLoading.value && materialHasMore.value) {
      void onLoadMaterials()
    }
    return
  }

  if (!assetLoading.value && assetHasMore.value) {
    void onLoadAssets()
  }
}

const openFile = (file: AssetItem) => {
  const isVideo = isVideoAsset(file)
  inspirationsInfo.value = {
    ...file,
    type: isVideo ? 'VIDEO' : 'IMAGE',
    resourceUrl: resolveAssetMediaUrl(file),
    title: resolveAssetTitle(file),
  };
  open.value = true;
}

const openInspiration = (item: MaterialItem) => {
  inspirationsInfo.value = {
    ...item,
    title: item.title || item.authorName || '素材',
  };
  open.value = true;
}

onMounted(() => {
  onLoadMaterialCategories();
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll)
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
