<template>
  <div class="canvas__empty">
    <p class="canvas__hint">
      <button type="button" class="canvas__hint-link">双击</button>画布在此处生成节点
    </p>
    <p class="canvas__hint">
      或在右侧
      <button type="button" class="canvas__hint-link" @click="emit('focus-chat')">chat</button>
      直接对话
    </p>
    <p class="canvas__hint">
      按住<button type="button" class="canvas__hint-link">Space</button>可以拖拽画布
    </p>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'focus-chat': []
}>()
</script>
