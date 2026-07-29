<template>
  <div
    v-if="visible && options.length > 1"
    class="mark-label-option-menu"
    :style="{ left: `${left}px`, top: `${top}px` }"
    @mousedown.stop
  >
    <button
      v-for="(option, index) in options"
      :key="`${option}-${index}`"
      type="button"
      class="mark-label-option-menu__item"
      @click.stop="emit('select', index)"
    >
      <span class="mark-label-option-menu__text">{{ option }}</span>
      <span
        class="mark-label-option-menu__dot"
        :class="{ 'mark-label-option-menu__dot--active': index === selectedIndex }"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  options: string[]
  selectedIndex: number
  left: number
  top: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()
</script>

<style scoped lang="scss">
.mark-label-option-menu {
  position: absolute;
  z-index: 30;
  min-width: 120px;
  padding: 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.mark-label-option-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #111827;
  font-size: 14px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.mark-label-option-menu__text {
  flex: 1;
  min-width: 0;
}

.mark-label-option-menu__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;

  &--active {
    background: #9ca3af;
  }
}
</style>
