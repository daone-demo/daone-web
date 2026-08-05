<template>
  <div
    class="canvas__group-bg"
    :class="{ 'canvas__group-bg--active': active }"
    :style="overlayStyle"
  >
    <div class="canvas__group-bg-frame" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  box: { left: number; top: number; width: number; height: number }
  active?: boolean
}>()

const overlayStyle = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
}))
</script>
