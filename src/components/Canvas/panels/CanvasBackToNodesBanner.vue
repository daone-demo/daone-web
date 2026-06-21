<template>
  <Transition name="canvas-back-to-nodes">
    <div class="canvas__back-to-nodes" @mousedown.stop>
      <div class="canvas__back-to-nodes-bar">
        <span class="canvas__back-to-nodes-text">
          当前视窗没有节点，可点击按钮快速回到内容区域
        </span>
        <button
          type="button"
          class="canvas__back-to-nodes-btn"
          :disabled="isRecentering"
          @click="emit('recenter')"
        >
          回到节点
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  isRecentering: boolean
}>()

const emit = defineEmits<{
  recenter: []
}>()
</script>
