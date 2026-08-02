<template>
  <div
    class="canvas__image-preview"
    role="dialog"
    :aria-label="kind === 'video' ? '视频预览' : '图片预览'"
    @mousedown.self="emit('close')"
    @click.self="emit('close')"
  >
    <video
      v-if="kind === 'video'"
      :src="url"
      controls
      playsinline
      @click.stop
    />
    <img v-else :src="url" alt="预览" @click.stop />
  </div>
</template>

<script setup lang="ts">
import type { MediaContextMenuKind } from '../constants'

defineProps<{
  url: string
  kind?: MediaContextMenuKind
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
