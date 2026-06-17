<template>
  <div
    class="canvas__image-preview"
    role="dialog"
    aria-label="图片预览"
    @mousedown.self="emit('close')"
    @click.self="emit('close')"
  >
    <img :src="url" alt="预览" @click.stop />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  url: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
