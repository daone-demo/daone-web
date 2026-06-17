<template>
  <div class="canvas__bottom-dock" @mousedown.stop>
    <button
      type="button"
      class="canvas__dock-btn canvas__dock-btn--add"
      title="添加节点"
      @click="emit('toggle-add-menu')"
    >
      +
    </button>
    <button type="button" class="canvas__dock-btn" title="分享">
      <span class="canvas__dock-icon canvas__dock-icon--share" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="canvas__dock-btn"
      :class="{ 'canvas__dock-btn--active': showConnectHint }"
      title="连线"
    >
      <span class="canvas__dock-icon canvas__dock-icon--graph" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="canvas__dock-btn"
      :class="{ 'canvas__dock-btn--active': showHistoryPanel }"
      title="历史记录"
      @click="emit('toggle-history-panel')"
    >
      <span class="canvas__dock-icon canvas__dock-icon--history" aria-hidden="true" />
    </button>
    <button type="button" class="canvas__dock-btn" title="文档">
      <span class="canvas__dock-icon canvas__dock-icon--doc" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="canvas__dock-btn"
      :class="{ 'canvas__dock-btn--active': showShortcutsPanel }"
      title="帮助"
      @click="emit('toggle-shortcuts')"
    >
      ?
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  showHistoryPanel: boolean
  showShortcutsPanel: boolean
  showConnectHint?: boolean
}>()

const emit = defineEmits<{
  'toggle-add-menu': []
  'toggle-history-panel': []
  'toggle-shortcuts': []
}>()
</script>
