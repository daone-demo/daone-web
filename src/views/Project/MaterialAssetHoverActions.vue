<template>
  <div class="home__inspiration-hover" @click.stop @mousedown.stop>
    <div
      class="home__inspiration-hover-btn"
      title="预览"
      aria-label="预览"
      @click="emit('preview')"
      style="display: flex;align-items: center;justify-content: center;"
    >
      <!-- <img :src="scanIcon" alt="" class="home__inspiration-hover-icon" /> -->
      <i class="iconfont icon-liulan" style="font-size: 24px;color: #ffffff;" />
    </div>
    <div
      class="home__inspiration-hover-btn"
      :title="favorited ? '取消收藏' : '收藏'"
      :aria-label="favorited ? '取消收藏' : '收藏'"
      @click="emit('toggle-favorite')"
      style="display: flex;align-items: center;justify-content: center;"
    >
      <!-- <img
        :src="favorited ? collectIcon : uncollectIcon"
        alt=""
        class="home__inspiration-hover-icon"
      /> -->
      <i class="iconfont icon-xz" v-if="favorited" style="font-size: 24px;color: #ff5500;" />
      <i class="iconfont icon-shoucang" v-else style="font-size: 24px;color: #ffffff;" />
    </div>
    <div
      class="home__inspiration-hover-btn"
      title="插入到画布"
      aria-label="插入到画布"
      @click="emit('insert-to-canvas')"
      style="display: flex;align-items: center;justify-content: center;"
    >
      <i class="iconfont icon-tianjiajia" style="font-size: 18px;color: #ffffff;" />
    </div>
  </div>
</template>

<script setup lang="ts">

defineProps<{
  favorited?: boolean
}>()

const emit = defineEmits<{
  preview: []
  'toggle-favorite': []
  'insert-to-canvas': []
}>()
</script>
