<template>
  <div v-if="item.key === 'addToDialog'" class="canvas__node-toolbar-hd">
    <img
      src="@assets/images/addToDialog.png"
      class="canvas__node-toolbar-addToDialog-img"
      @click="emit('action', item.key, undefined, item.label)"
    />
  </div>
  <div v-else-if="item.key === 'hd'" class="canvas__node-toolbar-hd">
    <button
      type="button"
      class="canvas__node-toolbar-btn"
      :class="{ 'canvas__node-toolbar-btn--active': showImageHdMenu }"
      :title="showToolNames ? undefined : item.label"
      @click="emit('action', item.key, undefined, item.label)"
    >
      <span v-if="showToolNames">{{ item.label }}</span>
      <span
        v-else
        class="canvas__node-toolbar-icon"
        :data-icon="item.icon || 'hd'"
        aria-hidden="true"
      />
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
      <span
        v-if="item.icon"
        class="canvas__node-toolbar-icon"
        :data-icon="item.icon"
        aria-hidden="true"
      />
      <span v-if="showToolNames">{{ item.label }}</span>
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
          {{ mode.label }}
        </button>
      </div>
    </div>
  </div>
  <button
    v-else
    type="button"
    class="canvas__node-toolbar-btn"
    :class="{ 'canvas__node-toolbar-btn--active': item.key === 'crop' && showImageCrop }"
    :title="showToolNames ? undefined : item.label"
    @click="emit('action', item.key, undefined, item.label)"
  >
    <span
      v-if="item.icon"
      class="canvas__node-toolbar-icon"
      :data-icon="item.icon"
      aria-hidden="true"
    />
    <span v-if="showToolNames">{{ item.label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IMAGE_HD_RESOLUTIONS, type ImageCapabilityToolbarAction } from '../constants'

const props = defineProps<{
  item: ImageCapabilityToolbarAction
  showImageHdMenu?: boolean
  showImageCrop?: boolean
  showToolNames?: boolean
}>()

const showToolNames = computed(() => props.showToolNames !== false)

const emit = defineEmits<{
  action: [key: string, option?: string, label?: string]
}>()
</script>
