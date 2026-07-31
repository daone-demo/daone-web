<template>
  <div class="canvas__empty">
    <p class="canvas__hint">
      <button type="button" class="canvas__hint-link">双击画布</button>自由生成节点
    </p>
    <p class="canvas__hint">
      长按
      <img
        src="@/assets/images/mouse.png"
        style="width: 16px; height: 16px;"
        alt="zoom"
      >
      或按住 Space + 拖拽可以移动画布
      <!-- <button type="button" class="canvas__hint-link" @click="emit('focus-chat')">chat</button>
      直接对话 -->
      &nbsp;
      滚动
      <img
        src="@/assets/images/mouse.png"
        style="width: 16px; height: 16px;"
        alt="zoom"
      >
      缩放画布
    </p>
    <!-- <p class="canvas__hint">
      滚动
      <img
        src="@/assets/images/mouse.png"
        style="width: 16px; height: 16px;"
        alt="zoom"
      >
      缩放画布
    </p> -->
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'focus-chat': []
}>()
</script>
