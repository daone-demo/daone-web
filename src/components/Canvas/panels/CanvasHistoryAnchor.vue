<template>
  <div class="canvas__history-anchor" @mousedown.stop>
    <CanvasHistoryPanel
      :list="list"
      :loading="loading"
      :has-more="hasMore"
      :restoring="restoring"
      @close="emit('close')"
      @load-more="emit('load-more')"
      @select="emit('select', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ProjectVersionRecord } from '@/services/api'
import CanvasHistoryPanel from '../CanvasHistoryPanel.vue'

const emit = defineEmits<{
  close: []
  'load-more': []
  select: [versionId: string]
}>()

defineProps<{
  list: ProjectVersionRecord[]
  loading?: boolean
  hasMore?: boolean
  restoring?: boolean
}>()
</script>
