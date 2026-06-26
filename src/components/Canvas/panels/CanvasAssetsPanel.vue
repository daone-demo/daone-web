<template>
  <aside
    class="canvas__assets"
    :class="{ 'canvas__assets--light': isLight }"
    @mousedown.stop
  >
    <div class="canvas__assets-head">
      <nav class="canvas__assets-tabs" aria-label="素材分类">
        <button
          v-for="item in PROJECT_TABS"
          :key="item.key"
          type="button"
          class="canvas__assets-tab"
          :class="{ 'canvas__assets-tab--active': tab === item.key }"
          @click="emit('update:tab', item.key)"
        >
          {{ item.label }}
        </button>
      </nav>
      <button type="button" class="canvas__assets-close" @click="emit('close')">×</button>
    </div>
    <div class="canvas__assets-body">
      <div
        v-if="list.length >0"
        class="project-panel__grid"
      >
        <div
          v-for="file in list"
          :key="file.id"
          class="project-card"
          :class="`project-card--${file.type}`"
          :draggable="isImageAsset(file)"
          role="button"
          tabindex="0"
          @click="onSelect(file)"
          @keydown.enter="onSelect(file)"
          @dragstart.stop="onDragStart($event, file)"
          @dragend.stop="onDragEnd"
        >
          <img
            class="project-card__image"
            :src="file.previewUrl"
            alt=""
            loading="lazy"
            draggable="false"
          />
        </div>
      </div>
      <p v-else class="canvas__assets-empty">暂无素材，上传后将显示在这里</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { AssetView } from '@/services/api'
import {
  CANVAS_ASSET_DRAG_TYPE,
  type CanvasAssetDragPayload,
} from '@/components/Canvas/constants'
import {
  endCanvasAssetDragSession,
  startCanvasAssetDrag,
  wasCanvasAssetDropHandled,
} from '@/components/Canvas/canvasAssetDrag'
import { PROJECT_TABS, type ProjectTabKey } from '@/views/Project/projectData'

defineProps<{
  tab: ProjectTabKey
  loading: boolean
  isLight?: boolean
  list: AssetView[]
}>()

const emit = defineEmits<{
  'update:tab': [tab: ProjectTabKey]
  close: []
  select: [asset: AssetView]
}>()

let suppressClick = false

function isImageAsset(asset: AssetView) {
  return asset.type?.toUpperCase() === 'IMAGE' && Boolean(asset.previewUrl)
}

function toDragPayload(asset: AssetView): CanvasAssetDragPayload {
  return {
    previewUrl: asset.previewUrl,
    fileName: asset.fileName,
    width: asset.width,
    height: asset.height,
  }
}

function onSelect(asset: AssetView) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (!isImageAsset(asset)) return
  emit('select', asset)
}

function onDragStart(event: DragEvent, asset: AssetView) {
  if (!isImageAsset(asset) || !event.dataTransfer) return

  suppressClick = true
  const payload = toDragPayload(asset)
  startCanvasAssetDrag(payload)
  event.dataTransfer.clearData()
  event.dataTransfer.setData('text/plain', asset.previewUrl)
  event.dataTransfer.setData(CANVAS_ASSET_DRAG_TYPE, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copy'
}

function onDragEnd() {
  window.setTimeout(() => {
    if (!wasCanvasAssetDropHandled()) {
      endCanvasAssetDragSession()
    }
  }, 0)
}
</script>
