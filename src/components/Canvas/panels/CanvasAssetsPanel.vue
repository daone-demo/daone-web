<template>
  <aside class="canvas__assets" @mousedown.stop>
    <div class="canvas__assets-head">
      <button
        type="button"
        :class="{ 'is-active': tab === 'all' }"
        @click="emit('update:tab', 'all')"
      >
        全部
      </button>
      <button
        type="button"
        :class="{ 'is-active': tab === 'mine' }"
        @click="emit('update:tab', 'mine')"
      >
        我的素材
      </button>
      <button type="button" class="canvas__assets-close" @click="emit('close')">×</button>
    </div>
    <div class="canvas__assets-body">
      <div v-if="loading" class="canvas__assets-loading">
        <span class="canvas__spinner" />
        <span>加载中...</span>
      </div>
      <p v-else class="canvas__assets-empty">暂无素材，上传后将显示在这里</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  tab: 'all' | 'mine'
  loading: boolean
}>()

const emit = defineEmits<{
  'update:tab': [tab: 'all' | 'mine']
  close: []
}>()
</script>
