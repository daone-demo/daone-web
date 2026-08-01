<template>
  <div
    class="image-gen-prompt-panel"
    :class="{ 'image-gen-prompt-panel--light': isLightTheme }"
    @mousedown.stop
  >
    <div class="image-gen-prompt-panel__head">
      <div class="image-gen-prompt-panel__tags">
        <button
          v-for="tag in IMG2IMG_QUICK_TAGS"
          :key="tag"
          type="button"
          class="image-gen-prompt-panel__tag"
        >
          {{ tag }}
        </button>
      </div>
      <button type="button" class="image-gen-prompt-panel__expand" title="展开">⤢</button>
    </div>

    <div
      v-if="props.sourceRefs.length"
      class="image-gen-prompt-panel__refs"
    >
      <div
        v-for="ref in props.sourceRefs"
        :key="ref.nodeId"
        class="image-gen-prompt-panel__ref"
        :class="{ 'image-gen-prompt-panel__ref--text': ref.kind === 'text' }"
        :title="ref.kind === 'text' ? ref.textPreview : ref.title"
        @mousedown.stop
      >
        <img v-if="ref.kind !== 'text'" :src="ref.previewUrl" alt="" />
        <div v-else class="image-gen-prompt-panel__text-card">
          <div class="image-gen-prompt-panel__text-card-inner">
            <svg
              class="image-gen-prompt-panel__text-icon"
              width="14"
              height="15"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <g transform="translate(1 0.5)">
                <path
                  d="M9.33 14.62H0v-2.1h9.33zM14 10.44H0v-2.1h14zm0-4.17H0v-2.1h14zm0-4.17H0V0h14z"
                  fill="currentColor"
                />
              </g>
            </svg>
          </div>
          <span class="image-gen-prompt-panel__ref-index">{{ ref.index }}</span>
        </div>
        <button
          type="button"
          class="image-gen-prompt-panel__ref-remove"
          title="删除"
          @click.stop="emit('remove-source-ref', ref.nodeId)"
        >
          ×
        </button>
        <span v-if="ref.kind !== 'text'" class="image-gen-prompt-panel__ref-badge">{{ ref.index }}</span>
      </div>
    </div>

    <textarea
      :value="props.prompt"
      class="image-gen-prompt-panel__input"
      :placeholder="IMG2IMG_PROMPT_PLACEHOLDER"
      rows="2"
      @input="onPromptInput"
    />
    <div class="image-gen-prompt-panel__footer">
      <button type="button" class="image-gen-prompt-panel__chip">Lib Nero Pro ▾</button>
      <button type="button" class="image-gen-prompt-panel__chip">16:9 · 2K</button>
      <button type="button" class="image-gen-prompt-panel__chip image-gen-prompt-panel__chip--icon" title="摄像机">
        📷 摄像机
      </button>
      <span class="image-gen-prompt-panel__tools">
        <button type="button" class="image-gen-prompt-panel__tool" title="翻译">文</button>
        <button type="button" class="image-gen-prompt-panel__tool" title="设置">☰</button>
      </span>
      <span class="image-gen-prompt-panel__count">1张</span>
      <span class="image-gen-prompt-panel__credits">⚡ 14</span>
      <input
        :value="props.seed"
        type="number"
        class="image-gen-prompt-panel__seed"
        min="0"
        max="999"
        title="随机种子"
        @input="onSeedInput"
      />
      <button
        type="button"
        class="image-gen-prompt-panel__send"
        :class="{ 'image-gen-prompt-panel__send--disabled': props.submitting }"
        :disabled="props.submitting"
        title="生成"
        @click="emit('generate')"
      >
        {{ props.submitting ? '…' : '↑' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IMG2IMG_PROMPT_PLACEHOLDER, IMG2IMG_QUICK_TAGS } from './constants'
import { useCanvasBgTheme } from './useCanvasBgTheme'
import type { VideoSourceRef } from './videoGen'

const { isLightTheme } = useCanvasBgTheme()

const props = withDefaults(
  defineProps<{
    prompt: string
    seed: number
    sourceRefs?: VideoSourceRef[]
    submitting?: boolean
  }>(),
  {
    sourceRefs: () => [],
    submitting: false,
  },
)

const emit = defineEmits<{
  'update:prompt': [value: string]
  'update:seed': [value: number]
  generate: []
  'remove-source-ref': [nodeId: string]
}>()

function onPromptInput(event: Event) {
  emit('update:prompt', (event.target as HTMLTextAreaElement).value)
}

function onSeedInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:seed', Number.isFinite(value) ? value : 0)
}
</script>

<style scoped lang="scss">
.image-gen-prompt-panel {
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #3d3d45;
  border-radius: 14px;
  background: rgba(24, 24, 28, 0.98);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);

  &--light {
    border-color: #e5e7eb;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.1);
  }
}

.image-gen-prompt-panel__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.image-gen-prompt-panel__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.image-gen-prompt-panel__tag {
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: #252528;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .image-gen-prompt-panel--light & {
    background: #f3f4f6;
    color: #6b7280;

    &:hover {
      background: #e5e7eb;
      color: #374151;
    }
  }
}

.image-gen-prompt-panel__refs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.image-gen-prompt-panel__ref {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #4b4b55;
  background: #2a2a30;
  flex-shrink: 0;

  &:hover .image-gen-prompt-panel__ref-remove {
    opacity: 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &--text {
    width: 48px;
    height: 48px;
    border-color: #e5e7eb;
    background: transparent;
    cursor: default;
  }

  .image-gen-prompt-panel--light & {
    border-color: #e5e7eb;
    background: transparent;
  }
}

.image-gen-prompt-panel__text-card {
  position: relative;
  width: 100%;
  height: 100%;
}

.image-gen-prompt-panel__text-card-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: #e5e7eb;
}

.image-gen-prompt-panel__text-icon {
  color: #525252;
  pointer-events: none;
}

.image-gen-prompt-panel__ref-index {
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 9px;
  line-height: 1;
  pointer-events: none;
}

.image-gen-prompt-panel__ref-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 9px;
  line-height: 1;
  pointer-events: none;
}

.image-gen-prompt-panel__ref-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.9);
  }
}

.image-gen-prompt-panel__expand {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .image-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.image-gen-prompt-panel__input {
  width: 100%;
  min-height: 52px;
  margin-bottom: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;

  &::placeholder {
    color: #6b7280;
  }

  .image-gen-prompt-panel--light & {
    color: #111827;

    &::placeholder {
      color: #9ca3af;
    }
  }
}

.image-gen-prompt-panel__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.image-gen-prompt-panel__chip {
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: #252528;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  &--icon {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .image-gen-prompt-panel--light & {
    background: #f3f4f6;
    color: #6b7280;

    &:hover {
      background: #e5e7eb;
      color: #374151;
    }
  }
}

.image-gen-prompt-panel__tools {
  display: flex;
  gap: 4px;
}

.image-gen-prompt-panel__tool {
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #252528;
    color: #e5e7eb;
  }

  .image-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.image-gen-prompt-panel__count,
.image-gen-prompt-panel__credits {
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;
}

.image-gen-prompt-panel__credits {
  margin-left: auto;
}

.image-gen-prompt-panel__seed {
  width: 40px;
  padding: 4px;
  border: 1px solid #3d3d45;
  border-radius: 6px;
  background: #252528;
  color: #e5e7eb;
  font-size: 11px;
  text-align: center;

  .image-gen-prompt-panel--light & {
    border-color: #e5e7eb;
    background: #f9fafb;
    color: #374151;
  }
}

.image-gen-prompt-panel__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #6b7cff;
  color: #fff;
  font-size: 18px;
  cursor: pointer;

  &:hover {
    background: #5b6cff;
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
