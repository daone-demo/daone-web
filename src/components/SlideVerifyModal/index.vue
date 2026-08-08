<template>
  <Teleport to="body">
    <Transition name="slide-verify-modal-fade">
      <div
        v-if="open"
        class="slide-verify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slide-verify-modal-title"
        @mousedown.self="close"
      >
        <div class="slide-verify-modal__dialog" @mousedown.stop>
          <header class="slide-verify-modal__header">
            <h3 id="slide-verify-modal-title" class="slide-verify-modal__title">
              请完成安全验证
            </h3>
            <button
              type="button"
              class="slide-verify-modal__close"
              aria-label="关闭"
              @click="close"
            >
              ×
            </button>
          </header>

          <div class="slide-verify-modal__body">
            <div v-if="!ready" class="slide-verify-modal__loading" aria-live="polite">
              <span class="slide-verify-modal__spinner" aria-hidden="true" />
              <span>加载中...</span>
            </div>
            <SlideVerify
              v-else
              ref="blockRef"
              :imgs="SLIDE_VERIFY_IMAGES"
              :l="42"
              :r="10"
              :w="310"
              :h="155"
              slider-text="拖动滑块完成拼图"
              @again="onAgain"
              @success="onSuccess"
              @fail="onFail"
              @refresh="onRefresh"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import SlideVerify, { type SlideVerifyInstance } from 'vue3-slide-verify'
import 'vue3-slide-verify/dist/style.css'
import { preloadSlideVerifyImages, SLIDE_VERIFY_IMAGES } from '@/utils/slideVerifyImages'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  success: [detail: { timestamp: number; left: number }]
  close: []
}>()

const blockRef = ref<SlideVerifyInstance>()
const ready = ref(false)
let successEmitted = false
let imagesPreloaded = false

function close() {
  open.value = false
  emit('close')
}

function refreshBlock() {
  blockRef.value?.refresh()
}

function onSuccess(detail: { timestamp: number; left: number }) {
  if (successEmitted) return
  successEmitted = true
  emit('success', detail)
  close()
}

function onFail() {
  refreshBlock()
}

function onRefresh() {
  successEmitted = false
}

function onAgain() {
  refreshBlock()
}

async function ensureReady() {
  if (!imagesPreloaded) {
    ready.value = false
    await preloadSlideVerifyImages()
    imagesPreloaded = true
  }
  ready.value = true
}

watch(open, async (visible) => {
  if (!visible) return
  successEmitted = false
  await ensureReady()
  await nextTick()
  refreshBlock()
})

onMounted(() => {
  void preloadSlideVerifyImages().then(() => {
    imagesPreloaded = true
  })
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
