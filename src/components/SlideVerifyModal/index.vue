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
            <SlideVerify
              ref="blockRef"
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
import { nextTick, ref, watch } from 'vue'
import SlideVerify, { type SlideVerifyInstance } from 'vue3-slide-verify'
import 'vue3-slide-verify/dist/style.css'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  success: [detail: { timestamp: number; left: number }]
  close: []
}>()

const blockRef = ref<SlideVerifyInstance>()
let successEmitted = false

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

watch(open, async (visible) => {
  if (visible) {
    successEmitted = false
    await nextTick()
    refreshBlock()
  }
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
