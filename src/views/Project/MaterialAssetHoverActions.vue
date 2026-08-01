<template>
  <div class="home__inspiration-hover" @click.stop @mousedown.stop>
    <div
      class="home__inspiration-hover-btn"
      title="预览"
      aria-label="预览"
      @click="emit('preview')"
    >
      <img :src="scanIcon" alt="" class="home__inspiration-hover-icon" />
    </div>
    <div
      class="home__inspiration-hover-btn"
      :title="favorited ? '取消收藏' : '收藏'"
      :aria-label="favorited ? '取消收藏' : '收藏'"
      @click="emit('toggle-favorite')"
    >
      <img
        :src="favorited ? collectIcon : uncollectIcon"
        alt=""
        class="home__inspiration-hover-icon"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import scanIcon from '@assets/images/scan.png'
import collectIcon from '@assets/images/collect.png'
import uncollectIcon from '@assets/images/uncollect.png'

defineProps<{
  favorited?: boolean
}>()

const emit = defineEmits<{
  preview: []
  'toggle-favorite': []
}>()
</script>
