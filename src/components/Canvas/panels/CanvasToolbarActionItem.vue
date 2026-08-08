<template>
  <!-- <div v-if="item.key === 'addToDialog'" class="canvas__node-toolbar-hd">
    <img
      src="@assets/images/addToDialog.png"
      class="canvas__node-toolbar-addToDialog-img"
      @click="emit('action', item.key, undefined, item.label)"
    />
  </div> -->
  <button
    type="button"
    class="canvas__node-toolbar-btn"
    :title="item.label"
    @click="emit('action', item.key, undefined, item.label)"
    v-if="item.key === 'addToDialog'"
  >
    <img
      src="@assets/images/addToDialog.png"
      class="canvas__node-toolbar-addToDialog-img"
      style="width: 18px; height: auto; object-fit: cover;margin-right: 2px;"
    />
    <span class="canvas__node-toolbar-label">添加到智能体</span>
  </button>
  <div v-else-if="item.key === 'hd'" class="canvas__node-toolbar-hd">
    <button
      type="button"
      class="canvas__node-toolbar-btn"
      :class="{ 'canvas__node-toolbar-btn--active': showImageHdMenu }"
      :title="item.label"
      @click="emit('action', item.key, undefined, item.label)"
    >
      <span
        class="canvas__node-toolbar-icon"
        :data-icon="item.icon || 'hd'"
        aria-hidden="true"
      />
      <span class="canvas__node-toolbar-label">{{ item.label }}</span>
    </button>
    <div
      v-if="showImageHdMenu"
      class="canvas__node-toolbar-hd-menu"
      @mousedown.stop
      @click.stop
    >
      <button
        v-for="resolution in IMAGE_HD_RESOLUTIONS"
        :key="resolution"
        type="button"
        class="canvas__node-toolbar-hd-item"
        @mousedown.stop
        @click.stop="emit('action', item.key, resolution, item.label)"
      >
        {{ resolution }}
      </button>
    </div>
  </div>
  <div
    v-else-if="item.type === 'dropdown' && item.modes.length"
    class="canvas__node-toolbar-dropdown"
  >
    <!-- 仅展开菜单，不直接触发能力；选择 mode 后再派发 -->
    <button
      type="button"
      class="canvas__node-toolbar-btn"
      @mousedown.stop
      @click.stop.prevent
    >
      <i class="iconfont" :class="item.icon" v-if="item.icon" style="font-size: 16px;"></i>
      <span class="canvas__node-toolbar-label">{{ item.label }}</span>
    </button>
    <div
      class="canvas__node-toolbar-dropdown-menu"
      @mousedown.stop
      @click.stop
      @pointerdown.stop
    >
      <div class="canvas__node-toolbar-dropdown-panel">
        <button
          v-for="mode in item.modes"
          :key="mode.value"
          type="button"
          class="canvas__node-toolbar-dropdown-item"
          @mousedown.stop
          @click.stop="emit('action', item.key, mode.value, item.label)"
        >
          {{ decodeDisplayText(mode.label) }}
        </button>
      </div>
    </div>
  </div>
  <button
    v-else
    type="button"
    class="canvas__node-toolbar-btn"
    :class="{ 'canvas__node-toolbar-btn--active': item.key === 'crop' && showImageCrop }"
    :title="item.label"
    @click="emit('action', item.key, undefined, item.label)"
  >
    <!-- <span
      v-if="item.icon"
      class="canvas__node-toolbar-icon"
      :data-icon="item.icon"
      aria-hidden="true"
    /> -->
    <i class="iconfont" :class="item.icon" v-if="item.icon" style="font-size: 16px;"></i>
    <span class="canvas__node-toolbar-label">{{ item.label }}</span>
  </button>
</template>

<script setup lang="ts">
import { IMAGE_HD_RESOLUTIONS, type ImageCapabilityToolbarAction } from '../constants'
import { decodeDisplayText } from '@/utils/decodeDisplayText'

defineProps<{
  item: ImageCapabilityToolbarAction
  showImageHdMenu?: boolean
  showImageCrop?: boolean
  showToolNames?: boolean
}>()

const emit = defineEmits<{
  action: [key: string, option?: string, label?: string]
}>()
</script>
