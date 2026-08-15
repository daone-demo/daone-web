<template>
  <button
    v-if="collapsed"
    type="button"
    class="chat-panel__msg-icon"
    :class="{ 'chat-panel__msg-icon--light': isLightTheme }"
    title="展开面板"
    aria-label="展开面板"
    @click="emit('expand')"
  >
    <img :src="logoSrc" alt="logo" class="chat-panel__msg-icon-logo" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  collapsed: boolean
  isLightTheme: boolean
  logoSrc: string
}>()

const emit = defineEmits<{
  expand: []
}>()
</script>
