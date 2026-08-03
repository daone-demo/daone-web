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
          :key="category.id"
          type="button"
          class="home__filter-btn"
          :class="{ 'home__filter-btn--active': activeCategoryCode === category.id }"
          @click="selectPrimaryCategory(category.id)"
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
          :key="subCategory.id"
          type="button"
          class="home__filter-btn home__filter-btn--sub"
          :class="{ 'home__filter-btn--active': activeSubCategoryCode === subCategory.id }"
          @click="selectSubCategory(subCategory.id)"
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
            :class="{
              'home__inspiration-card--batch-mode': batchSelectMode,
              'home__inspiration-card--batch-selected': batchSelectMode && isAssetSelected(item.id),
            }"
            :draggable="enableDrag && !batchSelectMode && canDragMaterial(item)"
            @click.stop="onMaterialClick(item)"
            @dragstart.stop="onMaterialDragStart($event, item)"
            @dragend.stop="onDragEnd"
          >
            <div
              class="home__inspiration-media"
              :class="{ 'home__inspiration-media--video': item.type === 'VIDEO' }"
            >
              <span
                v-if="batchSelectMode"
                class="material-assets__batch-check"
                :class="{ 'material-assets__batch-check--selected': isAssetSelected(item.id) }"
                aria-hidden="true"
              />
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
                v-if="!batchSelectMode"
                :favorited="item.favorited"
                @preview="openMaterialPreview(item)"
                @toggle-favorite="onDoToggleMaterialFavorite(item)"
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
      <div
        class="home__inspiration-grid"
        @scroll.passive="onAssetGridScroll"
      >
        <div
          v-for="(column, columnIndex) in assetColumns"
          :key="columnIndex"
          class="home__inspiration-column"
        >
          <!-- <button
            v-if="columnIndex === 0 && showAssetUpload"
            type="button"
            class="project-panel__upload-card"
            @click="triggerUpload"
          >
            <span class="project-card__upload-icon" aria-hidden="true">+</span>
            <span class="project-card__upload-label">上传素材</span>
          </button> -->
          <article
            v-for="item in column"
            :key="item.id"
            class="home__inspiration-card"
            :class="{
              'home__inspiration-card--batch-mode': batchSelectMode,
              'home__inspiration-card--batch-selected': batchSelectMode && isAssetSelected(item.id),
            }"
            :draggable="enableDrag && !batchSelectMode && canDragAsset(item)"
            @click.stop="onAssetClick(item)"
            @dragstart.stop="onAssetDragStart($event, item)"
            @dragend.stop="onDragEnd"
          >
            <div
              class="home__inspiration-media"
              :class="{ 'home__inspiration-media--video': isVideoAsset(item) }"
            >
              <span
                v-if="batchSelectMode"
                class="material-assets__batch-check"
                :class="{ 'material-assets__batch-check--selected': isAssetSelected(item.id) }"
                aria-hidden="true"
              />
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
                v-if="!batchSelectMode"
                :favorited="item.favorited"
                @preview="openAssetPreview(item)"
                @toggle-favorite="onDoToggleAssetFavorite(item)"
              />
            </div>
          </article>
        </div>
      </div>

      <p v-if="assetLoading" class="project-material__loading">加载中...</p>
      <p v-else-if="!assetHasMore && assetList.length" class="project-material__end">没有更多了</p>
      <p v-else-if="!assetLoading && !assetList.length && !showAssetUpload" class="project-material__empty">
        {{ scope === 'DIGITAL_HUMAN' ? '暂无数字人' : '暂无内容' }}
      </p>
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
import { computed, onMounted, onUnmounted, toRef, watch } from 'vue'
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
import { type AssetsFileType, type ProjectTabKey } from './projectData'
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
import { Modal } from 'ant-design-vue'
import { useMaterialAssets } from './useMaterialAssets'
import { useUserInfo } from '@/stores/useUserInfo'
import { useModalStore } from '@stores/useModal';

const userInfoStore = useUserInfo();
const modalStore = useModalStore();

const props = withDefaults(
  defineProps<{
    scope: ProjectTabKey
    columnCount?: number
    embedded?: boolean
    isLight?: boolean
    enableDrag?: boolean
    useWindowScroll?: boolean
    batchSelectMode?: boolean
    selectedAssetIds?: string[]
    assetType?: AssetsFileType
    assetDate?: unknown
  }>(),
  {
    columnCount: MATERIAL_COLUMN_COUNT,
    embedded: false,
    isLight: false,
    enableDrag: false,
    useWindowScroll: false,
    batchSelectMode: false,
    selectedAssetIds: () => [],
    assetType: 'all',
    assetDate: undefined,
  },
)

const emit = defineEmits<{
  'update:selectedAssetIds': [ids: string[]]
  'update:selectableAssetIds': [ids: string[]]
}>()

const scopeRef = toRef(props, 'scope')
const columnCountRef = computed(() => props.columnCount)
const assetTypeRef = toRef(props, 'assetType')
const assetDateRef = toRef(props, 'assetDate')
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
  reloadForFilters,
} = useMaterialAssets(scopeRef, columnCountRef, assetTypeRef, assetDateRef)

const onDoToggleMaterialFavorite = (item: MaterialItem) => {
  console.log(userInfoStore.userInfo?.isVip)
  if (userInfoStore.userInfo?.isVip) {
    toggleMaterialFavorite(item)
  } else {
    Modal.confirm({
      title: '提示',
      content: '该素材需要先升级会员才可使用',
      okText: '升级',
      cancelText: '取消',
      onOk: () => {
        modalStore.openModal('combo');
      },
    })
  }
}

const onDoToggleAssetFavorite = (item: AssetItem) => {
  if (!userInfoStore.userInfo?.isVip) {
    Modal.confirm({
      title: '提示',
      content: '该素材需要先升级会员才可使用',
      okText: '升级',
      cancelText: '取消',
      onOk: () => {
        modalStore.openModal('combo');
      },
    })
  } else {
    toggleAssetFavorite(item)
  }
}

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
  if (props.batchSelectMode) {
    toggleAssetSelection(item)
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

function onAssetClick(item: AssetItem) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (props.batchSelectMode) {
    toggleAssetSelection(item)
    return
  }
  openAssetPreview(item)
}

function isAssetSelected(id: string) {
  return props.selectedAssetIds.includes(id)
}

function toggleAssetSelection(item: AssetItem | MaterialItem) {
  const current = props.selectedAssetIds
  const next = current.includes(item.id)
    ? current.filter((id) => id !== item.id)
    : [...current, item.id]
  emit('update:selectedAssetIds', next)
}

function getSelectableAssetIds(): string[] {
  if (isMaterialListScope(props.scope)) {
    return materialList.value
      .filter((item) => resolveMaterialMediaUrl(item))
      .map((item) => item.id)
  }

  return assetList.value
    .filter((item) => resolveAssetMediaUrl(item))
    .map((item) => item.id)
}

function selectAllAssets() {
  emit('update:selectedAssetIds', getSelectableAssetIds())
}

function clearAssetSelection() {
  emit('update:selectedAssetIds', [])
}

function getSelectedAssetPayloads(): CanvasAssetDragPayload[] {
  const selected = new Set(props.selectedAssetIds)

  if (isMaterialListScope(props.scope)) {
    return materialList.value
      .filter((item) => selected.has(item.id) && resolveMaterialMediaUrl(item))
      .map((item) => materialToDragPayload(item))
  }

  return assetList.value
    .filter((item) => selected.has(item.id) && resolveAssetMediaUrl(item))
    .map((item) => toDragPayload(item))
}

defineExpose({
  getSelectedAssetPayloads,
  reloadForFilters,
  getSelectableAssetIds,
  selectAllAssets,
  clearAssetSelection,
})

watch(
  [materialList, assetList, () => props.scope],
  () => {
    emit('update:selectableAssetIds', getSelectableAssetIds())
  },
  { deep: true, immediate: true },
)

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

  .home__inspiration-hover,
  .home__inspiration-hover :deep(*) {
    pointer-events: auto;
    user-select: auto;
  }

  .home__inspiration-hover-btn {
    cursor: default;
  }
}

.home__inspiration-card--batch-mode {
  cursor: pointer;
}

.home__inspiration-card--batch-selected {
  .home__inspiration-media {
    box-shadow: inset 0 0 0 2px #2563eb;
  }
}

.material-assets__batch-check {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.35);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}

.material-assets__batch-check--selected {
  border-color: #2563eb;
  background: #2563eb;

  &::before {
    content: '✓';
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
