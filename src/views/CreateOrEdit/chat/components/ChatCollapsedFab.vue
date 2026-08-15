<template>
  <button
    v-if="collapsed"
    type="button"
    class="chat-panel__expand"
    title="展开面板"
    aria-label="展开面板"
    @click="emit('expand')"
  >
    <span class="chat-panel__icon chat-panel__icon--expand" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  collapsed: boolean
}>()

const emit = defineEmits<{
  expand: []
}>()
</script>
