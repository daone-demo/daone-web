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
      <MaterialAssetsContent
        :key="tab"
        :scope="tab"
        :column-count="CANVAS_MATERIAL_COLUMN_COUNT"
        embedded
        :is-light="isLight"
        enable-drag
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import MaterialAssetsContent from '@/views/Project/MaterialAssetsContent.vue'
import { PROJECT_TABS, type ProjectTabKey } from '@/views/Project/projectData'

const CANVAS_MATERIAL_COLUMN_COUNT = 3

defineProps<{
  tab: ProjectTabKey
  isLight?: boolean
}>()

const emit = defineEmits<{
  'update:tab': [tab: ProjectTabKey]
  close: []
}>()
</script>
