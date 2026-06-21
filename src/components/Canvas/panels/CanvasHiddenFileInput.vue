<template>
  <input
    ref="inputRef"
    type="file"
    class="canvas__file-input"
    :accept="accept"
    :multiple="multiple"
    @change="emit('change', $event)"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  accept: string
  multiple: boolean
}>()

const emit = defineEmits<{
  change: [event: Event]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

defineExpose({ inputRef })
</script>
