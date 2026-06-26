<template>
  <aside
    class="canvas__asset-center"
    :class="{ 'canvas__asset-center--light': isLight }"
    @mousedown.stop
  >
    <header class="canvas__asset-center-header">
      <h2 class="canvas__asset-center-title">我的skill</h2>
      <div class="canvas__asset-center-actions">
        <button type="button" class="canvas__asset-center-icon-btn" title="筛选" aria-label="筛选">
          <span class="canvas__asset-center-icon canvas__asset-center-icon--filter" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="canvas__asset-center-icon-btn"
          title="收起"
          aria-label="收起"
          @click="emit('close')"
        >
          <span class="canvas__asset-center-icon canvas__asset-center-icon--collapse" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="canvas__asset-center-body">
      <button
        type="button"
        class="canvas__asset-center-section-toggle"
        @click="sectionOpen = !sectionOpen"
      >
        <span
          class="canvas__asset-center-section-caret"
          :class="{ 'is-open': sectionOpen }"
          aria-hidden="true"
        />
        已添加至此项目的资产
      </button>

      <div v-show="sectionOpen" class="canvas__asset-center-section">
        <p v-if="loading" class="canvas__asset-center-empty">加载中...</p>
        <p v-else-if="!filteredList.length" class="canvas__asset-center-empty">暂无资产</p>

        <div
          v-for="item in filteredList"
          :key="String(item.id)"
          class="canvas__asset-center-item-wrap"
          @mouseenter="setHovered($event, item)"
          @mouseleave="clearHovered"
        >
          <div
            class="canvas__asset-center-item"
            :class="{ 'canvas__asset-center-item--draggable': canDrag(item) }"
            :draggable="canDrag(item)"
            @dragstart.stop="onDragStart($event, item)"
            @dragend.stop="onDragEnd"
          >
            <span class="canvas__asset-center-item-thumb">
              <img
                v-if="getPreviewUrl(item)"
                :src="getPreviewUrl(item)"
                alt=""
                loading="lazy"
                draggable="false"
              />
              <span v-else class="canvas__asset-center-item-placeholder" aria-hidden="true" />
            </span>
            <span class="canvas__asset-center-item-name">{{ displayName(item) }}</span>
            <div class="canvas__asset-center-item-actions">
              <button
                type="button"
                class="canvas__asset-center-item-action"
                aria-label="添加到画布"
                @click.stop="onAddToCanvas(item)"
              >
                <span class="canvas__asset-center-item-action-icon canvas__asset-center-item-action-icon--add" aria-hidden="true" />
                <span class="canvas__asset-center-item-action-tip">添加到画布</span>
              </button>
              <button
                type="button"
                class="canvas__asset-center-item-action"
                aria-label="添加到对话"
                @click.stop="onAddToDialog(item)"
              >
                <span class="canvas__asset-center-item-action-icon canvas__asset-center-item-action-icon--mention" aria-hidden="true" />
                <span class="canvas__asset-center-item-action-tip">添加到对话</span>
              </button>
            </div>
          </div>

          <div
            v-if="hoveredId === String(item.id)"
            class="canvas__asset-center-preview"
            :style="previewStyle"
            @mouseenter="keepPreview(item)"
            @mouseleave="clearHovered"
          >
            <div class="canvas__asset-center-preview-head">
              <span class="canvas__asset-center-preview-name">{{ displayName(item) }}</span>
              <span class="canvas__asset-center-preview-role">{{ getRole(item) }}</span>
            </div>
            <p class="canvas__asset-center-preview-summary">
              包含 {{ getFiles(item).length }} 个文件
            </p>
            <ul class="canvas__asset-center-preview-files">
              <li
                v-for="file in getFiles(item)"
                :key="file.id"
                class="canvas__asset-center-preview-file"
              >
                <span class="canvas__asset-center-preview-file-thumb">
                  <img
                    v-if="file.previewUrl"
                    :src="file.previewUrl"
                    alt=""
                    loading="lazy"
                    draggable="false"
                  />
                  <span v-else class="canvas__asset-center-item-placeholder" aria-hidden="true" />
                </span>
                <span class="canvas__asset-center-preview-file-name">{{ file.fileName }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AssetCenterTabKey } from '../assetCenterData'
import type { ElementGroupRecord } from '../assetCenterData'
import {
  getAssetCenterDisplayName,
  getAssetCenterFiles,
  getAssetCenterPreviewUrl,
  getAssetCenterRole,
} from '../assetCenterData'
import { CANVAS_ELEMENT_GROUP_DRAG_TYPE } from '../constants'
import { parseElementGroupRecord } from '../groupSkill'
import {
  endCanvasAssetDragSession,
  startCanvasElementGroupDrag,
  wasCanvasAssetDropHandled,
} from '../canvasAssetDrag'

const props = defineProps<{
  tab: AssetCenterTabKey
  search: string
  loading: boolean
  list: ElementGroupRecord[]
  isLight?: boolean
}>()

const emit = defineEmits<{
  'update:tab': [tab: AssetCenterTabKey]
  'update:search': [value: string]
  close: []
  select: [item: ElementGroupRecord]
  'add-to-chat': [payload: { id: string; role: string; name: string }]
}>()

const sectionOpen = ref(true)
const hoveredId = ref('')
const previewStyle = ref<Record<string, string>>({})
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const filteredList = computed(() => {
  const keyword = props.search.trim().toLowerCase()
  return props.list.filter((item) => {
    const role = getRole(item)
    if (props.tab !== 'ALL' && role !== props.tab) return false
    if (!keyword) return true
    const name = displayName(item).toLowerCase()
    return name.includes(keyword)
  })
})

function displayName(item: ElementGroupRecord) {
  return getAssetCenterDisplayName(item)
}

function getRole(item: ElementGroupRecord) {
  return getAssetCenterRole(item)
}

function getPreviewUrl(item: ElementGroupRecord) {
  return getAssetCenterPreviewUrl(item)
}

function getFiles(item: ElementGroupRecord) {
  return getAssetCenterFiles(item)
}

function canDrag(item: ElementGroupRecord) {
  return Boolean(parseElementGroupRecord(item))
}

function setHovered(event: MouseEvent, item: ElementGroupRecord) {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  hoveredId.value = String(item.id)

  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  previewStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.right + 10}px`,
  }
}

function keepPreview(item: ElementGroupRecord) {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  hoveredId.value = String(item.id)
}

function clearHovered() {
  hoverTimer = setTimeout(() => {
    hoveredId.value = ''
    previewStyle.value = {}
    hoverTimer = null
  }, 120)
}

function onAddToCanvas(item: ElementGroupRecord) {
  if (!canDrag(item)) return
  emit('select', item)
}

function onAddToDialog(item: ElementGroupRecord) {
  emit('add-to-chat', {
    id: String(item.id),
    role: getRole(item),
    name: displayName(item),
  })
}

function toDragPayload(item: ElementGroupRecord) {
  return {
    recordId: String(item.id),
    name: displayName(item),
    structureJson: item.structureJson ?? item.projectStructure ?? item.structure,
  }
}

function onDragStart(event: DragEvent, item: ElementGroupRecord) {
  if (!canDrag(item) || !event.dataTransfer) return

  const payload = toDragPayload(item)
  startCanvasElementGroupDrag(payload)
  event.dataTransfer.clearData()
  event.dataTransfer.setData('text/plain', payload.name)
  event.dataTransfer.setData(CANVAS_ELEMENT_GROUP_DRAG_TYPE, JSON.stringify(payload))
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
