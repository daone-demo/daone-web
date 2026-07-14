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
            <template v-for="item in IMAGE_NODE_TOOLBAR_MORE.actions" :key="item.key">
              <div v-if="item.key === 'more'" class="canvas__node-toolbar-more">
                <button
                  type="button"
                  class="canvas__node-toolbar-btn"
                  :class="{ 'canvas__node-toolbar-btn--active': showImageToolbarMoreMenu }"
                  @click="emit('toggle-image-toolbar-more-menu')"
                >
                  <span
                    v-if="item.icon"
                    class="canvas__node-toolbar-icon"
                    :data-icon="item.icon"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </button>
                <div
                  v-if="showImageToolbarMoreMenu"
                  class="canvas__node-toolbar-menu"
                  @mousedown.stop
                >
                  <button
                    v-for="menuItem in IMAGE_NODE_TOOLBAR_MORE_MENU"
                    :key="menuItem.key"
                    type="button"
                    class="canvas__node-toolbar-menu-item"
                  >
                    <span
                      class="canvas__node-toolbar-icon"
                      :data-icon="menuItem.icon"
                      aria-hidden="true"
                    />
                    <span class="canvas__node-toolbar-menu-label">{{ menuItem.label }}</span>
                    <span
                      v-if="menuItem.hasSubmenu"
                      class="canvas__node-toolbar-menu-arrow"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
              <div v-else class="canvas__node-toolbar-hover">
                <button type="button" class="canvas__node-toolbar-btn">
                  <span
                    v-if="item.icon"
                    class="canvas__node-toolbar-icon"
                    :data-icon="item.icon"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </button>
                <span
                  v-if="getImageToolbarMoreHover(item.key)?.tooltip"
                  class="canvas__node-toolbar-tooltip-label"
                >
                  {{ getImageToolbarMoreHover(item.key)?.tooltip }}
                </span>
                <div
                  v-if="getImageToolbarMoreHover(item.key)?.menu?.length"
                  class="canvas__node-toolbar-dropdown-menu"
                  @mousedown.stop
                >
                  <button
                    v-for="menuLabel in getImageToolbarMoreHover(item.key)?.menu"
                    :key="menuLabel"
                    type="button"
                    class="canvas__node-toolbar-dropdown-item"
                  >
                    {{ menuLabel }}
                  </button>
                </div>
              </div>
            </template>
          </div>
          <span class="canvas__node-toolbar-divider" aria-hidden="true" />
          <button type="button" class="canvas__node-toolbar-btn canvas__node-toolbar-btn--icon" title="下载">
            <span class="canvas__node-toolbar-icon" data-icon="download" aria-hidden="true" />
          </button>
        </template>
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
            <template v-for="item in IMAGE_NODE_TOOLBAR.actions" :key="item.key">
              <div v-if="item.key === 'IMAGE_REMOVE_BG'" class="canvas__node-toolbar-dropdown">
                <button
                  type="button"
                  class="canvas__node-toolbar-btn"
                  @click="emitImageAction(item.key)"
                >
                  <span
                    class="canvas__node-toolbar-icon"
                    data-icon="cutout"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </button>
                <div class="canvas__node-toolbar-dropdown-menu" @mousedown.stop>
                  <button
                    v-for="mode in IMAGE_CUTOUT_MODES"
                    :key="mode"
                    type="button"
                    class="canvas__node-toolbar-dropdown-item"
                    @click="emitImageAction(item.key, mode)"
                  >
                    {{ mode }}
                  </button>
                </div>
              </div>
              <div v-else-if="item.key === 'hd'" class="canvas__node-toolbar-hd">
                <button
                  type="button"
                  class="canvas__node-toolbar-btn"
                  :class="{ 'canvas__node-toolbar-btn--active': showImageHdMenu }"
                  @click="emitImageAction(item.key)"
                >
                  {{ item.label }}
                </button>
                <div
                  v-if="showImageHdMenu"
                  class="canvas__node-toolbar-hd-menu"
                  @mousedown.stop
                >
                  <button
                    v-for="resolution in IMAGE_HD_RESOLUTIONS"
                    :key="resolution"
                    type="button"
                    class="canvas__node-toolbar-hd-item"
                    @click="emitImageAction(item.key, resolution)"
                  >
                    {{ resolution }}
                  </button>
                </div>
              </div>
              <div v-else-if="item.key === 'inpaint'" class="canvas__node-toolbar-tooltip">
                <button
                  type="button"
                  class="canvas__node-toolbar-btn"
                  @click="emitImageAction(item.key)"
                >
                  <span
                    class="canvas__node-toolbar-icon"
                    data-icon="edit"
                    aria-hidden="true"
                  />
                  {{ item.label }}
                </button>
                <span class="canvas__node-toolbar-tooltip-label">{{ item.label }}</span>
              </div>
              <div v-else-if="item.key === 'addToDialog'" class="canvas__node-toolbar-hd">
                <img
                  src="@assets/images/addToDialog.png"
                  class="canvas__node-toolbar-addToDialog-img"
                  @click="emitImageAction(item.key)"
                />
              </div>
              <button
                v-else
                type="button"
                class="canvas__node-toolbar-btn"
                :class="{ 'canvas__node-toolbar-btn--active': item.key === 'crop' && showImageCrop }"
                @click="emitImageAction(item.key)"
              >
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
import {
  IMAGE_NODE_TOOLBAR,
  IMAGE_NODE_TOOLBAR_MORE,
  IMAGE_NODE_TOOLBAR_MORE_MENU,
  IMAGE_NODE_CREATIVE_TOOLBAR,
  IMAGE_HD_RESOLUTIONS,
  IMAGE_CUTOUT_MODES,
  getImageToolbarMoreHover,
  VIDEO_NODE_TOOLBAR,
  type NodeKind,
  type ImageToolbarClickPayload,
} from '../constants'

function emitImageAction(key: string, option?: string) {
  const payload: ImageToolbarClickPayload = option ? { key, option } : { key }
  emit('image-toolbar-action', payload)
}

defineProps<{
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
</script>
