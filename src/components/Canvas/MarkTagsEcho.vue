<template>
  <div v-if="marks.length" class="mark-tags-echo">
    <div class="mark-tags-echo__list">
      <button
        v-for="(mark, index) in marks"
        :key="mark.id"
        type="button"
        class="mark-tags-echo__tag"
        :class="{
          'mark-tags-echo__tag--switchable': hasMultipleMarkLabels(mark) && !mark.pending,
          'mark-tags-echo__tag--loading': mark.pending,
        }"
        @mousedown.stop
        @click="onTagClick(mark, $event)"
      >
        <span class="mark-tags-echo__index">{{ index + 1 }}.</span>
        <span class="mark-tags-echo__label">{{ mark.label }}</span>
        <span
          v-if="mark.pending"
          class="mark-tags-echo__spinner"
          aria-hidden="true"
        />
        <span
          v-else
          class="mark-tags-echo__remove"
          title="移除标记"
          @mousedown.stop
          @click.stop="emit('remove', mark.id)"
        >
          ×
        </span>
      </button>
    </div>
    <button
      v-if="marks.some((mark) => !mark.pending)"
      type="button"
      class="mark-tags-echo__clear"
      title="清空全部标记"
      @mousedown.stop
      @click.stop="emit('clear')"
    >
      <span class="mark-tags-echo__clear-icon" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ImageMarkItem } from './constants'
import { hasMultipleMarkLabels } from './useImageMarkLabelMenu'

defineProps<{
  marks: ImageMarkItem[]
}>()

const emit = defineEmits<{
  remove: [markId: string]
  clear: []
  'open-label-menu': [markId: string, anchor: HTMLElement]
}>()

function onTagClick(mark: ImageMarkItem, event: MouseEvent) {
  if (mark.pending || !hasMultipleMarkLabels(mark)) return
  emit('open-label-menu', mark.id, event.currentTarget as HTMLElement)
}
</script>

<style scoped lang="scss">
@use './promptMention.scss' as *;

.mark-tags-echo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 8px 0;
}

.mark-tags-echo__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.mark-tags-echo__tag {
  @include prompt-mark-tag-pill;
  padding-right: 8px;
  border: 1px solid transparent;

  &--switchable {
    cursor: pointer;
  }

  &--loading {
    cursor: default;
    border-color: #93c5fd;
    background: #eff6ff;
    color: #2563eb;
  }
}

.mark-tags-echo__index {
  font-weight: 600;
}

.mark-tags-echo__label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mark-tags-echo__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  border-radius: 50%;
  color: #6b7280;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.08);
    color: #111827;
  }
}

.mark-tags-echo__spinner {
  width: 14px;
  height: 14px;
  margin-left: 2px;
  border: 2px solid rgba(37, 99, 235, 0.2);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: mark-tags-echo-spin 0.8s linear infinite;
}

.mark-tags-echo__clear {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-top: 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.06);
  }
}

.mark-tags-echo__clear-icon {
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M2.5 4.5h11M6.2 4.5V3.2a.7.7 0 0 1 .7-.7h2.2a.7.7 0 0 1 .7.7v1.3m1.4 0-.5 8.1a.8.8 0 0 1-.8.7H5.1a.8.8 0 0 1-.8-.7l-.5-8.1'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}

@keyframes mark-tags-echo-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
