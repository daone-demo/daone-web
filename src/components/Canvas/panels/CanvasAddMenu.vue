<template>
  <div
    class="canvas__add-menu"
    :class="{
      'canvas__add-menu--floating': Boolean(dropPoint),
      'canvas__add-menu--light': canvasBgTheme === 'light',
    }"
    :style="dropPoint ? { left: `${position.left}px`, top: `${position.top}px` } : undefined"
    @mousedown.stop
  >
    <section v-for="group in ADD_NODE_GROUPS" :key="group.title" class="canvas__add-group">
      <h4 class="canvas__add-title">{{ group.title }}</h4>
      <button
        v-for="item in group.items"
        :key="`${group.title}-${item.label}`"
        type="button"
        class="canvas__add-item"
        @click="emit('select', item)"
      >
        <i class="iconfont" :class="item.icon" style="font-size: 18px;"></i>
        <span class="canvas__add-item-label">
          {{ item.label }}
          <em
            v-if="'badge' in item && item.badge"
            class="canvas__add-badge"
            :class="{
              'canvas__add-badge--new': item.badge === 'NEW',
              'canvas__add-badge--beta': item.badge === 'Beta',
            }"
          >
            {{ item.badge }}
          </em>
        </span>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ADD_NODE_GROUPS } from '../constants'
import type { CanvasBgTheme } from '../canvasTheme'

defineProps<{
  canvasBgTheme: CanvasBgTheme
  dropPoint: { x: number; y: number } | null
  position: { left: number; top: number }
}>()

const emit = defineEmits<{
  select: [item: (typeof ADD_NODE_GROUPS)[number]['items'][number]]
}>()
</script>
