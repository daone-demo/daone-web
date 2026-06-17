<template>
  <Teleport to="body">
    <Transition name="login-modal-fade">
      <div
        v-if="open"
        class="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        @mousedown.self="close"
      >
        <div class="login-modal__dialog" @mousedown.stop>
          <button
            type="button"
            class="login-modal__close"
            aria-label="关闭"
            @click="close"
          >
            ×
          </button>
          <div class="login-modal__body">
            <section class="login-modal__phone">
              <h3 class="login-modal__col-title">手机号登录</h3>
              <div class="login-modal__field">
                <label class="login-modal__input-wrap">
                  <span class="login-modal__dial">+86</span>
                  <input
                    v-model="phone"
                    type="tel"
                    class="login-modal__input"
                    placeholder="请输入手机号"
                    maxlength="11"
                    autocomplete="tel"
                  />
                </label>
              </div>

              <div class="login-modal__field">
                <label class="login-modal__code-wrap">
                  <input
                    v-model="smsCode"
                    type="text"
                    class="login-modal__input"
                    placeholder="请输入验证码"
                    maxlength="6"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                  />
                  <button
                    type="button"
                    class="login-modal__code-btn"
                    :disabled="codeSending || codeCountdown > 0 || !phoneValid"
                    @click="sendCode"
                  >
                    {{ codeBtnText }}
                  </button>
                </label>
              </div>

              <button
                type="button"
                class="login-modal__submit"
                :disabled="!canSubmit"
                @click="submitLogin"
              >
                登录/注册
              </button>
            </section>

            <div class="login-modal__divider" aria-hidden="true" />

            <section class="login-modal__scan">
              <h3 class="login-modal__col-title">微信扫码登录</h3>

              <div class="login-modal__qr">
                <img
                  class="login-modal__qr-img"
                  :src="wechatQrUrl"
                  alt="微信扫码登录二维码"
                  width="148"
                  height="148"
                />
              </div>
              <p class="login-modal__scan-hint">使用微信扫码快捷登录</p>
            </section>
          </div>

          <footer class="login-modal__footer">
            登录即代表同意
            <button type="button" class="login-modal__link" @click="emit('user-agreement')">
              《用户协议》
            </button>
            和
            <button type="button" class="login-modal__link" @click="emit('privacy-policy')">
              《隐私政策》
            </button>
            未注册手机号将自动注册
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  close: []
  submit: [payload: { phone: string; code: string }]
  'send-code': [phone: string]
  'qq-login': []
  'user-agreement': []
  'privacy-policy': []
}>()

const phone = ref('')
const smsCode = ref('')
const codeCountdown = ref(0)
const codeSending = ref(false)

let countdownTimer: ReturnType<typeof setInterval> | null = null

/** 演示用微信登录二维码（内联 SVG，无需外网） */
const wechatQrUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='148' height='148' viewBox='0 0 148 148'%3E%3Crect width='148' height='148' fill='%23fff'/%3E%3Cg fill='%23111827'%3E%3Crect x='12' y='12' width='36' height='36' rx='4'/%3E%3Crect x='100' y='12' width='36' height='36' rx='4'/%3E%3Crect x='12' y='100' width='36' height='36' rx='4'/%3E%3Crect x='20' y='20' width='20' height='20' fill='%23fff'/%3E%3Crect x='108' y='20' width='20' height='20' fill='%23fff'/%3E%3Crect x='20' y='108' width='20' height='20' fill='%23fff'/%3E%3Crect x='26' y='26' width='8' height='8'/%3E%3Crect x='114' y='26' width='8' height='8'/%3E%3Crect x='26' y='114' width='8' height='8'/%3E%3C/g%3E%3Cg fill='%23111827'%3E%3Crect x='56' y='12' width='8' height='8'/%3E%3Crect x='72' y='12' width='8' height='8'/%3E%3Crect x='64' y='20' width='8' height='8'/%3E%3Crect x='80' y='28' width='8' height='8'/%3E%3Crect x='56' y='36' width='8' height='8'/%3E%3Crect x='88' y='44' width='8' height='8'/%3E%3Crect x='12' y='56' width='8' height='8'/%3E%3Crect x='28' y='56' width='8' height='8'/%3E%3Crect x='44' y='64' width='8' height='8'/%3E%3Crect x='60' y='56' width='8' height='8'/%3E%3Crect x='76' y='64' width='8' height='8'/%3E%3Crect x='92' y='56' width='8' height='8'/%3E%3Crect x='108' y='64' width='8' height='8'/%3E%3Crect x='124' y='56' width='8' height='8'/%3E%3Crect x='52' y='72' width='8' height='8'/%3E%3Crect x='68' y='80' width='8' height='8'/%3E%3Crect x='84' y='72' width='8' height='8'/%3E%3Crect x='100' y='88' width='8' height='8'/%3E%3Crect x='56' y='96' width='8' height='8'/%3E%3Crect x='72' y='104' width='8' height='8'/%3E%3Crect x='88' y='112' width='8' height='8'/%3E%3Crect x='104' y='104' width='8' height='8'/%3E%3Crect x='120' y='112' width='8' height='8'/%3E%3Crect x='64' y='120' width='8' height='8'/%3E%3C/g%3E%3C/svg%3E"

const phoneValid = computed(() => /^1\d{10}$/.test(phone.value.trim()))

const canSubmit = computed(
  () => phoneValid.value && /^\d{4,6}$/.test(smsCode.value.trim()),
)

const codeBtnText = computed(() => {
  if (codeCountdown.value > 0) return `${codeCountdown.value}s`
  return '获取验证码'
})

function close() {
  open.value = false
  emit('close')
}

function startCountdown(seconds = 60) {
  codeCountdown.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    codeCountdown.value -= 1
    if (codeCountdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

async function sendCode() {
  if (!phoneValid.value || codeCountdown.value > 0) return
  codeSending.value = true
  emit('send-code', phone.value.trim())
  try {
    await new Promise((resolve) => setTimeout(resolve, 400))
    startCountdown()
  } finally {
    codeSending.value = false
  }
}

function submitLogin() {
  if (!canSubmit.value) return
  emit('submit', {
    phone: phone.value.trim(),
    code: smsCode.value.trim(),
  })
}

function lockBodyScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(open, (visible) => {
  lockBodyScroll(visible)
  if (!visible) {
    phone.value = ''
    smsCode.value = ''
    codeCountdown.value = 0
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }
})

onBeforeUnmount(() => {
  lockBodyScroll(false)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
