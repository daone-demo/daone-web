<template>
  <div
    class="material-assets"
    :class="{
      'material-assets--embedded': embedded,
      'material-assets--light': isLight,
      'material-assets--draggable': enableDrag,
    }"
  >
    <section
      v-if="showMaterialList"
      class="material-assets__section material-assets__section--center"
    >
      <div v-if="scope === 'CENTER'" class="home__filters">
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
        v-if="scope === 'CENTER' && materialSubCategories.length > 0"
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
            :draggable="enableDrag && canDragMaterial(item)"
            @click.stop="onMaterialClick(item)"
            @dragstart.stop="onMaterialDragStart($event, item)"
            @dragend.stop="onDragEnd"
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
                draggable="false"
              />
              <EmbeddedVideoPlayer
                v-else-if="item.type === 'VIDEO'"
                :src="resolveMaterialMediaUrl(item)"
                preview
              />
              <MaterialAssetHoverActions
                :favorited="item.favorited"
                @preview="openMaterialPreview(item)"
                @toggle-favorite="toggleMaterialFavorite(item)"
              />
            </div>
          </article>
        </div>
      </div>

      <p v-if="materialLoading" class="project-material__loading">加载中...</p>
      <p v-else-if="!materialHasMore && materialList.length" class="project-material__end">没有更多了</p>
      <p v-else-if="!materialLoading && !materialList.length" class="project-material__empty">
        {{ scope === 'FAVORITE' ? '暂无收藏' : '暂无素材' }}
      </p>
    </section>

    <section v-else class="material-assets__section material-assets__section--assets">
      <input
        ref="uploadInputRef"
        class="project-card__upload-input"
        type="file"
        accept="image/*"
        multiple
        @change="handleUploadChange"
      />
      <div
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
            <span class="project-card__upload-label">上传素材</span>
          </button>
          <article
            v-for="item in column"
            :key="item.id"
            class="home__inspiration-card"
            :draggable="enableDrag && canDragAsset(item)"
            @click.stop="onAssetClick(item)"
            @dragstart.stop="onAssetDragStart($event, item)"
            @dragend.stop="onDragEnd"
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
                draggable="false"
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
              <MaterialAssetHoverActions
                :favorited="item.favorited"
                @preview="openAssetPreview(item)"
                @toggle-favorite="toggleAssetFavorite(item)"
              />
            </div>
          </article>
        </div>
      </div>

      <p v-if="assetLoading" class="project-material__loading">加载中...</p>
      <p v-else-if="!assetHasMore && assetList.length" class="project-material__end">没有更多了</p>
      <p v-else-if="!assetLoading && !assetList.length && !showAssetUpload" class="project-material__empty">暂无内容</p>
    </section>

    <a-modal
      v-model:open="previewOpen"
      width="800px"
      class="home__inspiration-modal"
    >
      <img
        v-if="previewItem?.type === 'IMAGE'"
        :src="previewItem.resourceUrl"
        :alt="previewItem.title"
        style="width: 100%; height: 100%;"
      />
      <EmbeddedVideoPlayer
        v-if="previewItem?.type === 'VIDEO'"
        :src="previewItem.resourceUrl"
        object-fit="contain"
        aspect-ratio="auto"
        min-height="360px"
        class="home__inspiration-modal-player"
      />
      <template #title />
      <template #footer />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import EmbeddedVideoPlayer from '@components/EmbeddedVideoPlayer/index.vue'
import MaterialAssetHoverActions from './MaterialAssetHoverActions.vue'
import {
  CANVAS_ASSET_DRAG_TYPE,
  type CanvasAssetDragPayload,
} from '@/components/Canvas/constants'
import {
  rememberImageNaturalSize,
  resolveImageNaturalSizeCached,
} from '@/components/Canvas/imageDisplayUrl'
import {
  endCanvasAssetDragSession,
  startCanvasAssetDrag,
  wasCanvasAssetDropHandled,
} from '@/components/Canvas/canvasAssetDrag'
import type { ProjectTabKey } from './projectData'
import {
  MATERIAL_COLUMN_COUNT,
  SCROLL_LOAD_THRESHOLD,
  isMaterialListScope,
  isVideoAsset,
  resolveAssetMediaUrl,
  resolveAssetTitle,
  resolveMaterialMediaUrl,
  resolveMaterialTitle,
  type AssetItem,
  type MaterialItem,
} from './materialAssets'
import { useMaterialAssets } from './useMaterialAssets'

const props = withDefaults(
  defineProps<{
    scope: ProjectTabKey
    columnCount?: number
    embedded?: boolean
    isLight?: boolean
    enableDrag?: boolean
    useWindowScroll?: boolean
  }>(),
  {
    columnCount: MATERIAL_COLUMN_COUNT,
    embedded: false,
    isLight: false,
    enableDrag: false,
    useWindowScroll: false,
  },
)

const emit = defineEmits<{
  upload: [files: File[]]
}>()

const scopeRef = toRef(props, 'scope')
const columnCountRef = computed(() => props.columnCount)
const showMaterialList = computed(() => isMaterialListScope(props.scope))

const {
  materialCategories,
  materialSubCategories,
  activeCategoryCode,
  activeSubCategoryCode,
  materialList,
  materialColumns,
  materialLoading,
  materialHasMore,
  assetList,
  assetColumns,
  assetLoading,
  assetHasMore,
  showAssetUpload,
  previewOpen,
  previewItem,
  loadForScope,
  selectPrimaryCategory,
  selectSubCategory,
  openMaterialPreview,
  openAssetPreview,
  toggleMaterialFavorite,
  toggleAssetFavorite,
  onMaterialGridScroll,
  onAssetGridScroll,
  onLoadMaterials,
  onLoadAssets,
} = useMaterialAssets(scopeRef, columnCountRef)

const uploadInputRef = ref<HTMLInputElement | null>(null)

let suppressClick = false

function canDragMaterial(item: MaterialItem): boolean {
  return Boolean(resolveMaterialMediaUrl(item))
}

function canDragAsset(item: AssetItem): boolean {
  return Boolean(resolveAssetMediaUrl(item))
}

function onMaterialClick(item: MaterialItem) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  openMaterialPreview(item)
}

function materialToDragPayload(item: MaterialItem): CanvasAssetDragPayload {
  const isVideo = item.type === 'VIDEO'
  return {
    assetId: item.id,
    previewUrl: resolveMaterialMediaUrl(item),
    fileName: resolveMaterialTitle(item),
    mediaType: isVideo ? 'VIDEO' : 'IMAGE',
  }
}

function onMaterialDragStart(event: DragEvent, item: MaterialItem) {
  startCanvasDrag(event, materialToDragPayload(item))
}

function triggerUpload() {
  uploadInputRef.value?.click()
}

function handleUploadChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  emit('upload', files)
  input.value = ''
}

function onAssetClick(item: AssetItem) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  openAssetPreview(item)
}

function toDragPayload(item: AssetItem): CanvasAssetDragPayload {
  return {
    assetId: item.id,
    previewUrl: resolveAssetMediaUrl(item),
    fileName: resolveAssetTitle(item),
    width: item.width ?? null,
    height: item.height ?? null,
    mediaType: isVideoAsset(item) ? 'VIDEO' : 'IMAGE',
  }
}

function startCanvasDrag(event: DragEvent, payload: CanvasAssetDragPayload) {
  if (!props.enableDrag || !payload.previewUrl || !event.dataTransfer) return

  suppressClick = true
  startCanvasAssetDrag(payload)
  event.dataTransfer.clearData()
  event.dataTransfer.setData('text/plain', payload.previewUrl)
  event.dataTransfer.setData(CANVAS_ASSET_DRAG_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copy'

  if (payload.mediaType !== 'VIDEO') {
    if (payload.width && payload.height) {
      rememberImageNaturalSize(payload.previewUrl, payload.width, payload.height)
    } else {
      void resolveImageNaturalSizeCached(payload.previewUrl)
    }
  }
}

function onAssetDragStart(event: DragEvent, item: AssetItem) {
  startCanvasDrag(event, toDragPayload(item))
}

function onDragEnd() {
  window.setTimeout(() => {
    if (!wasCanvasAssetDropHandled()) {
      endCanvasAssetDragSession()
    }
  }, 0)
}

function onWindowScroll() {
  if (!props.useWindowScroll) return

  const reachedBottom =
    window.innerHeight + window.scrollY
    >= document.documentElement.scrollHeight - SCROLL_LOAD_THRESHOLD
  if (!reachedBottom) return

  if (isMaterialListScope(props.scope)) {
    if (!materialLoading.value && materialHasMore.value) {
      void onLoadMaterials()
    }
    return
  }

  if (!assetLoading.value && assetHasMore.value) {
    void onLoadAssets()
  }
}

onMounted(() => {
  void loadForScope(props.scope)
  if (props.useWindowScroll) {
    window.addEventListener('scroll', onWindowScroll, { passive: true })
  }
})

onUnmounted(() => {
  if (props.useWindowScroll) {
    window.removeEventListener('scroll', onWindowScroll)
  }
})
</script>

<style scoped lang="scss">
@import './index.scss';

.material-assets--draggable {
  .home__inspiration-media,
  .home__inspiration-media :deep(*) {
    pointer-events: none;
    user-select: none;
  }

  .home__inspiration-hover {
    pointer-events: auto;
  }
}

.material-assets--embedded {
  .home__filters {
    margin-bottom: 12px;
    gap: 6px;
  }

  .home__filters--sub {
    margin-top: -4px;
    margin-bottom: 12px;
  }

  .home__filter-btn {
    height: 28px;
    padding: 0 10px;
    font-size: 12px;
    color: #9ca3af;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #e5e7eb;
    }

    &--sub {
      height: 26px;
      padding: 0 8px;
      font-size: 11px;
    }

    &--active {
      background: #3d3d45;
      color: #f3f4f6;

      &:hover {
        background: #4b4b55;
        color: #f9fafb;
      }
    }
  }

  .home__inspiration-grid {
    max-height: calc(100vh - 220px);
    max-height: calc(100dvh - 220px);
    gap: 8px;
  }

  .home__inspiration-column {
    gap: 8px;
  }

  .home__inspiration-card[draggable='true'] {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  .project-material__loading,
  .project-material__end,
  .project-material__empty {
    margin-top: 8px;
    font-size: 12px;
    color: #6b7280;
  }
}

.material-assets--embedded.material-assets--light {
  .home__filter-btn {
    color: #6b7280;

    &--active {
      background: #111827;
      color: #fff;
    }
  }
}
</style>
