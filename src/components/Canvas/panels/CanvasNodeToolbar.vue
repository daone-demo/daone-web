<template>
  <div
    class="canvas__node-toolbar"
    :class="{ 'canvas__node-toolbar--image': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <template v-if="showFeatureButtons">
      <template v-if="selectedKind === 'image'">
        <template v-if="showImageCreativeToolbar">
          <div class="canvas__node-toolbar-group">
            <button
              v-for="item in IMAGE_NODE_CREATIVE_TOOLBAR.actions"
              :key="item.key"
              type="button"
              class="canvas__node-toolbar-btn"
            >
              {{ item.label }}
              <span v-if="'badge' in item && item.badge" class="canvas__node-toolbar-badge">{{ item.badge }}</span>
            </button>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <button
            v-for="item in IMAGE_NODE_CREATIVE_TOOLBAR.icons"
            :key="item.key"
            type="button"
            class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
            :title="item.label"
          >
            <span class="canvas__node-toolbar-icon" :data-icon="item.icon" aria-hidden="true" />
          </button>
        </template>

        <!-- 主工具栏：对话 + addToDialog + 前 6 个 + 更多(下拉剩余全部) + 下载 -->
        <template v-else>
          <div class="canvas__node-toolbar-group">
            <button
              type="button"
              class="canvas__node-toolbar-btn"
              :class="{ 'canvas__node-toolbar-btn--active': showImageDialogue }"
              :title="IMAGE_NODE_TOOLBAR.chat.label"
              @click="emitImageAction(IMAGE_NODE_TOOLBAR.chat.key)"
            >
              <i class="iconfont icon-duihuaqipao" style="font-size: 16px;"></i>
              <span class="canvas__node-toolbar-label">{{ IMAGE_NODE_TOOLBAR.chat.label }}</span>
            </button>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <div class="canvas__node-toolbar-group">
            <CanvasToolbarActionItem
              :item="addToDialogAction"
              :show-tool-names="showToolNames"
              @action="emitImageAction"
            />
            <CanvasToolbarActionItem
              v-for="(item, index) in primaryActions"
              :key="`primary-${item.key}-${index}`"
              :item="item"
              :show-image-hd-menu="showImageHdMenu"
              :show-image-crop="showImageCrop"
              :show-tool-names="showToolNames"
              @action="emitImageAction"
            />
            <div v-if="overflowActions.length" class="canvas__node-toolbar-more">
              <button
                type="button"
                class="canvas__node-toolbar-btn"
                :class="{ 'canvas__node-toolbar-btn--active': showImageToolbarMore }"
                :title="IMAGE_NODE_TOOLBAR.more.label"
                @mousedown.stop
                @click.stop="emitImageAction(IMAGE_NODE_TOOLBAR.more.key)"
              >
                <span
                  class="canvas__node-toolbar-icon"
                  :data-icon="IMAGE_NODE_TOOLBAR.more.icon"
                  aria-hidden="true"
                />
                <span class="canvas__node-toolbar-label">{{ IMAGE_NODE_TOOLBAR.more.label }}</span>
                <span class="canvas__node-toolbar-more-count">{{ overflowActions.length }}</span>
              </button>
              <div
                v-if="showImageToolbarMore"
                class="canvas__node-toolbar-more-panel"
                @mousedown.stop
                @click.stop
                @pointerdown.stop
              >
                <CanvasToolbarActionItem
                  v-for="(item, index) in overflowActions"
                  :key="`overflow-${item.key}-${index}`"
                  :item="item"
                  :show-image-hd-menu="showImageHdMenu"
                  :show-image-crop="showImageCrop"
                  :show-tool-names="showToolNames"
                  @action="onOverflowAction"
                />
              </div>
            </div>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
            title="下载"
            @click="emitImageAction('download')"
          >
            <!-- <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" /> -->
            <i class="iconfont icon-xiazai" style="font-size: 14px;"></i>
          </button>
        </template>
      </template>

      <template v-else-if="selectedKind === 'video'">
        <div class="canvas__node-toolbar-group">
          <button
            type="button"
            class="canvas__node-toolbar-btn"
            :class="{ 'canvas__node-toolbar-btn--active': showVideoDialogue }"
            @click="emitVideoAction({ key: 'chat', label: VIDEO_NODE_TOOLBAR.chat.label })"
          >
            <!-- <span class="canvas__node-toolbar-icon" data-icon="chat" aria-hidden="true" /> -->
             <i class="iconfont icon-duihuaqipao" style="font-size: 16px;"></i>
            <span class="canvas__node-toolbar-label">{{ VIDEO_NODE_TOOLBAR.chat.label }}</span>
          </button>
        </div>
        <!-- <span class="canvas__node-toolbar-divider" aria-hidden="true" /> -->
        <div class="canvas__node-toolbar-group">
          <!-- <div class="canvas__node-toolbar-hd">
            <img
              src="@assets/images/addToDialog.png"
              class="canvas__node-toolbar-addToDialog-img"
              @click="emitVideoAction({ key: 'addToDialog', label: '' })"
            />
          </div> -->
          <button
            v-for="item in videoToolbarActions"
            :key="item.key"
            type="button"
            class="canvas__node-toolbar-btn"
            :class="{
              'canvas__node-toolbar-btn--active':
                (isVideoHdAction(item) && showVideoHdPanel) ||
                (isVideoFramesAction(item) && showVideoFramesPanel),
            }"
            @click="emitVideoAction(item)"
          >
            <i class="iconfont" :class="item.icon" v-if="item.icon" style="font-size: 16px;"></i>
            <span class="canvas__node-toolbar-label">{{ item.label }}</span>
          </button>
        </div>
        <span class="canvas__node-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
          title="下载"
          @click="emitVideoAction({ key: 'download', label: '下载' })"
        >
        <i class="iconfont icon-xiazai" style="font-size: 14px;"></i>
        </button>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CanvasToolbarActionItem from './CanvasToolbarActionItem.vue'
import {
  IMAGE_NODE_TOOLBAR,
  IMAGE_NODE_CREATIVE_TOOLBAR,
  IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT,
  VIDEO_NODE_TOOLBAR,
  buildImageToolbarActionsFromCapabilities,
  buildVideoToolbarActionsFromCapabilities,
  normalizeImageCapabilities,
  toCapabilityToolbarActions,
  splitImageToolbarActions,
  createAddToDialogToolbarAction,
  resolveVideoToolbarUiKey,
  type NodeKind,
  type ImageToolbarClickPayload,
  type VideoToolbarClickPayload,
  type ImageCapability,
  type ImageCapabilityToolbarAction,
} from '../constants'

import {
  orderImageToolbarActions,
  type ImageToolbarCustomizeSettings,
} from '../imageToolbarCustomize'

const props = defineProps<{
  position: { left: number; top: number }
  isLight: boolean
  showFeatureButtons: boolean
  selectedKind: NodeKind | null
  showImageCreativeToolbar: boolean
  showImageToolbarMore: boolean
  showImageToolbarMoreMenu: boolean
  showImageHdMenu: boolean
  showImageDialogue: boolean
  showImageCrop: boolean
  showVideoDialogue: boolean
  showVideoHdPanel: boolean
  showVideoFramesPanel: boolean
  imageCapabilities: ImageCapability[]
  videoCapabilities?: ImageCapability[]
  imageToolbarCustomizeSettings?: ImageToolbarCustomizeSettings
  toolbarRevision?: number
}>()

const emit = defineEmits<{
  'close-image-toolbar-more': []
  'toggle-image-toolbar-more-menu': []
  'toggle-image-dialogue': []
  'image-toolbar-action': [payload: ImageToolbarClickPayload]
  'toggle-video-dialogue': []
  'toggle-video-hd-panel': []
  'toggle-video-frames-panel': []
  'add-video-to-dialog': []
  'video-toolbar-action': [payload: VideoToolbarClickPayload]
}>()

const allActions = computed<ImageCapabilityToolbarAction[]>(() => {
  void props.toolbarRevision
  const fromApi = buildImageToolbarActionsFromCapabilities(props.imageCapabilities)
  const raw = fromApi.length ? fromApi : toCapabilityToolbarActions(IMAGE_NODE_TOOLBAR.actions)
  return orderImageToolbarActions(raw, props.imageToolbarCustomizeSettings)
})

const showToolNames = computed(() => props.imageToolbarCustomizeSettings?.showToolNames !== false)

const splitActions = computed(() =>
  splitImageToolbarActions(allActions.value, IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT),
)

const addToDialogAction = createAddToDialogToolbarAction()
const primaryActions = computed(() => splitActions.value.primaryActions)
const overflowActions = computed(() => splitActions.value.overflowActions)

const videoToolbarActions = computed<ImageCapabilityToolbarAction[]>(() => {
  const capabilities = normalizeImageCapabilities(props.videoCapabilities)
  if (capabilities.length > 0) {
    return buildVideoToolbarActionsFromCapabilities(capabilities)
  }
  return toCapabilityToolbarActions(VIDEO_NODE_TOOLBAR.actions)
})

function isVideoHdAction(item: ImageCapabilityToolbarAction) {
  const uiKey = resolveVideoToolbarUiKey(item.key)
  return uiKey === 'hd' || item.key === 'VIDEO_HD'
}

function isVideoFramesAction(item: ImageCapabilityToolbarAction) {
  const uiKey = resolveVideoToolbarUiKey(item.key)
  return uiKey === 'frames' || item.key.includes('FRAME')
}

function emitImageAction(key: string, option?: string, label?: string) {
  const payload: ImageToolbarClickPayload = { key }
  if (option) payload.option = option
  if (label) payload.label = label
  emit('image-toolbar-action', payload)
}

function emitVideoAction(item: { key: string; label?: string; option?: string }) {
  const payload: VideoToolbarClickPayload = { key: item.key }
  if (item.option) payload.option = item.option
  if (item.label) payload.label = item.label
  emit('video-toolbar-action', payload)
}

function onOverflowAction(key: string, option?: string, label?: string) {
  emit('close-image-toolbar-more')
  emitImageAction(key, option, label)
}
</script>
