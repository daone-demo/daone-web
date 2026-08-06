<template>
  <div
    class="canvas__image-context-menu"
    :class="{ 'canvas__image-context-menu--light': isLight }"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
    @contextmenu.prevent
  >
    <template v-for="(section, sectionIndex) in sections" :key="`section-${sectionIndex}`">
      <div v-if="sectionIndex > 0" class="canvas__image-context-menu-divider" aria-hidden="true" />
      <button
        v-for="item in section"
        :key="item.key"
        type="button"
        class="canvas__image-context-menu-item"
        :class="{ 'canvas__image-context-menu-item--danger': item.danger }"
        @click="emit('select', item.key)"
      >
        <!-- <span
          class="canvas__image-context-menu-icon"
          :class="`canvas__image-context-menu-icon--${resolveIcon(item)}`"
          aria-hidden="true"
        /> -->
        <img
          v-if="item.key == 'send-agent'"
          src="@assets/images/addToDialog.png"
          style="width: 18px; height: auto;"
        >
        <i class="iconfont" :class="item.icon" v-if="item.key != 'send-agent' && item.icon" style="font-size: 16px;"></i>
        <span class="canvas__image-context-menu-label">{{ resolveLabel(item) }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  getMediaContextMenuSections,
  type ImageContextMenuItem,
  type MediaContextMenuKind,
} from '../constants'

const props = defineProps<{
  position: { left: number; top: number }
  kind?: MediaContextMenuKind
  isLight?: boolean
  nodeLocked?: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const sections = computed(() => getMediaContextMenuSections(props.kind ?? 'image'))

function resolveLabel(item: ImageContextMenuItem) {
  if (item.key === 'lock') {
    return props.nodeLocked ? '解锁' : '锁定'
  }
  return item.label
}

// function resolveIcon(item: ImageContextMenuItem) {
//   if (item.key === 'lock' && props.nodeLocked) {
//     return 'unlock'
//   }
//   return item.icon
// }
</script>
