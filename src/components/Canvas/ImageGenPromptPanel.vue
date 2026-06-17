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
        <span v-if="sourcePreviewUrl" class="image-gen-prompt-panel__ref-thumb">
          <img :src="sourcePreviewUrl" alt="" />
        </span>
      </div>
      <button type="button" class="image-gen-prompt-panel__expand" title="展开">⤢</button>
    </div>
    <textarea
      :value="prompt"
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
        :value="seed"
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
        :class="{ 'image-gen-prompt-panel__send--disabled': submitting }"
        :disabled="submitting"
        title="生成"
        @click="emit('generate')"
      >
        {{ submitting ? '…' : '↑' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IMG2IMG_PROMPT_PLACEHOLDER, IMG2IMG_QUICK_TAGS } from './constants'
import { useCanvasBgTheme } from './useCanvasBgTheme'

const { isLightTheme } = useCanvasBgTheme()

defineProps<{
  prompt: string
  seed: number
  sourcePreviewUrl?: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  'update:prompt': [value: string]
  'update:seed': [value: number]
  generate: []
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

.image-gen-prompt-panel__ref-thumb {
  display: block;
  width: 28px;
  height: 28px;
  margin-left: auto;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #4b4b55;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
