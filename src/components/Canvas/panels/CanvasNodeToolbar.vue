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

        <!-- 更多：展示第 7 个起的剩余 actions -->
        <template v-else-if="showImageToolbarMore">
          <button
            type="button"
            class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
            title="返回"
            @click="emit('close-image-toolbar-more')"
          >
            <span class="canvas__node-toolbar-icon" data-icon="back" aria-hidden="true" />
          </button>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <div class="canvas__node-toolbar-group">
            <CanvasToolbarActionItem
              v-for="item in overflowActions"
              :key="item.key"
              :item="item"
              :show-image-hd-menu="showImageHdMenu"
              :show-image-crop="showImageCrop"
              @action="emitImageAction"
            />
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
            title="下载"
            @click="emitImageAction('download')"
          >
            <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
          </button>
        </template>

        <!-- 主工具栏：对话 + 前 6 个 actions +（超限时）更多 + 下载 -->
        <template v-else>
          <div class="canvas__node-toolbar-group">
            <button
              type="button"
              class="canvas__node-toolbar-btn"
              :class="{ 'canvas__node-toolbar-btn--active': showImageDialogue }"
              @click="emitImageAction(IMAGE_NODE_TOOLBAR.chat.key)"
            >
              <span class="canvas__node-toolbar-icon" data-icon="chat" aria-hidden="true" />
              {{ IMAGE_NODE_TOOLBAR.chat.label }}
            </button>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <div class="canvas__node-toolbar-group">
            <!-- 固定：加入对话，始终在 actions 最前 -->
            <CanvasToolbarActionItem
              :item="addToDialogAction"
              @action="emitImageAction"
            />
            <CanvasToolbarActionItem
              v-for="item in primaryActions"
              :key="item.key"
              :item="item"
              :show-image-hd-menu="showImageHdMenu"
              :show-image-crop="showImageCrop"
              @action="emitImageAction"
            />
            <button
              v-if="overflowActions.length"
              type="button"
              class="canvas__node-toolbar-btn"
              @click="emitImageAction(IMAGE_NODE_TOOLBAR.more.key)"
            >
              <span
                class="canvas__node-toolbar-icon"
                :data-icon="IMAGE_NODE_TOOLBAR.more.icon"
                aria-hidden="true"
              />
              {{ IMAGE_NODE_TOOLBAR.more.label }}
            </button>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon"
            title="下载"
            @click="emitImageAction('download')"
          >
            <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
          </button>
        </template>
      </template>

      <template v-else-if="selectedKind === 'video'">
        <div class="canvas__node-toolbar-group">
          <button
            type="button"
            class="canvas__node-toolbar-btn"
            :class="{ 'canvas__node-toolbar-btn--active': showVideoDialogue }"
            @click="emit('toggle-video-dialogue')"
          >
            <span class="canvas__node-toolbar-icon" data-icon="chat" aria-hidden="true" />
            {{ VIDEO_NODE_TOOLBAR.chat.label }}
          </button>
        </div>
        <span class="canvas__node-toolbar-divider" aria-hidden="true" />
        <div class="canvas__node-toolbar-group">
          <template v-for="item in VIDEO_NODE_TOOLBAR.actions" :key="item.key">
            <button
              v-if="item.key === 'hd'"
              type="button"
              class="canvas__node-toolbar-btn"
              :class="{ 'canvas__node-toolbar-btn--active': showVideoHdPanel }"
              @click="emit('toggle-video-hd-panel')"
            >
              <span
                class="canvas__node-toolbar-icon"
                data-icon="video-hd"
                aria-hidden="true"
              />
              {{ item.label }}
            </button>
            <button
              v-else-if="item.key === 'frames'"
              type="button"
              class="canvas__node-toolbar-btn"
              :class="{ 'canvas__node-toolbar-btn--active': showVideoFramesPanel }"
              @click="emit('toggle-video-frames-panel')"
            >
              <span
                class="canvas__node-toolbar-icon"
                data-icon="frames"
                aria-hidden="true"
              />
              {{ item.label }}
            </button>
            <div v-else-if="item.key === 'addToDialog'" class="canvas__node-toolbar-hd">
              <img
                src="@assets/images/addToDialog.png"
                class="canvas__node-toolbar-addToDialog-img"
                @click="emit('add-video-to-dialog')"
              />
            </div>
            <button v-else type="button" class="canvas__node-toolbar-btn">
              <span
                v-if="item.icon"
                class="canvas__node-toolbar-icon"
                :data-icon="item.icon"
                aria-hidden="true"
              />
              {{ item.label }}
            </button>
          </template>
        </div>
        <span class="canvas__node-toolbar-divider" aria-hidden="true" />
        <button type="button" class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon" title="下载">
          <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
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
  toCapabilityToolbarActions,
  splitImageToolbarActions,
  createAddToDialogToolbarAction,
  type NodeKind,
  type ImageToolbarClickPayload,
  type ImageCapability,
  type ImageCapabilityToolbarAction,
} from '../constants'

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
}>()

/** 接口能力优先；未返回时用静态兜底（已排除 addToDialog 等固定项） */
const allActions = computed<ImageCapabilityToolbarAction[]>(() => {
  const fromApi = buildImageToolbarActionsFromCapabilities(props.imageCapabilities)
  if (fromApi.length) return fromApi
  return toCapabilityToolbarActions(IMAGE_NODE_TOOLBAR.actions)
})

const splitActions = computed(() =>
  splitImageToolbarActions(allActions.value, IMAGE_TOOLBAR_VISIBLE_ACTION_LIMIT),
)

const addToDialogAction = createAddToDialogToolbarAction()
const primaryActions = computed(() => splitActions.value.primaryActions)
const overflowActions = computed(() => splitActions.value.overflowActions)

function emitImageAction(key: string, option?: string, label?: string) {
  const payload: ImageToolbarClickPayload = { key }
  if (option) payload.option = option
  if (label) payload.label = label
  emit('image-toolbar-action', payload)
}
</script>
