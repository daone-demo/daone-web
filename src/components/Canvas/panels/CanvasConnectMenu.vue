<template>
  <div
    class="canvas__connect-menu canvas__connect-menu--floating"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @mousedown.stop
  >
    <h4 class="canvas__connect-title">添加上下文</h4>
    <button
      v-for="item in CONNECT_GENERATE_MENU"
      :key="item.key"
      type="button"
      class="canvas__connect-item"
      :class="{ 'canvas__connect-item--disabled': item.disabled }"
      :disabled="item.disabled"
      @click="emit('select', item)"
    >
      <i class="iconfont" :class="item.icon" style="font-size: 18px;"></i>
      <span class="canvas__connect-label">
        {{ item.label }}
        <em
          v-if="item.badge"
          class="canvas__connect-badge"
          :class="{
            'canvas__connect-badge--new': item.badge === 'NEW',
            'canvas__connect-badge--beta': item.badge === 'Beta',
          }"
        >
          {{ item.badge }}
        </em>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { CONNECT_GENERATE_MENU } from '../constants'

defineProps<{
  position: { left: number; top: number }
}>()

const emit = defineEmits<{
  select: [item: (typeof CONNECT_GENERATE_MENU)[number]]
}>()
</script>
