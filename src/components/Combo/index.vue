<template>
  <Teleport to="body">
    <Transition name="combo-modal-fade">
      <div
        v-if="open"
        class="combo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-modal-title"
        @mousedown.self="close"
      >
        <div
          class="combo-modal__dialog"
          :class="{ 'combo-modal__dialog--trial': memberTab === 'trial' }"
          @mousedown.stop
        >
          <button
            type="button"
            class="combo-modal__close"
            aria-label="关闭"
            @click="close"
          >
            ×
          </button>

          <header class="combo-modal__header">
            <div v-if="memberTab === 'enterprise'" class="combo-modal__header-top">
              <p class="combo-modal__identity">
                当前身份：<strong>普通用户</strong>
              </p>
              <button type="button" class="combo-modal__service" @click="emit('contact-service')">
                联系客服
              </button>
            </div>

            <div class="combo-modal__header-center">
              <div class="combo-modal__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  class="combo-modal__tab"
                  :class="{ 'combo-modal__tab--active': memberTab === 'enterprise' }"
                  :aria-selected="memberTab === 'enterprise'"
                  @click="memberTab = 'enterprise'"
                >
                  企业会员
                </button>
                <button
                  type="button"
                  role="tab"
                  class="combo-modal__tab combo-modal__tab--trial"
                  :class="{ 'combo-modal__tab--active': memberTab === 'trial' }"
                  :aria-selected="memberTab === 'trial'"
                  @click="memberTab = 'trial'"
                >
                  申请试用
                </button>
              </div>

              <div
                v-if="memberTab === 'enterprise'"
                class="combo-modal__billing"
                role="group"
                aria-label="付费周期"
              >
                <button
                  type="button"
                  class="combo-modal__billing-btn"
                  :class="{ 'combo-modal__billing-btn--active': billing === 'yearly' }"
                  @click="billing = 'yearly'"
                >
                  年付
                  <span v-if="billing === 'yearly'" class="combo-modal__billing-badge">最高 3.75 折</span>
                </button>
                <button
                  type="button"
                  class="combo-modal__billing-btn"
                  :class="{ 'combo-modal__billing-btn--active': billing === 'monthly' }"
                  @click="billing = 'monthly'"
                >
                  月付
                </button>
              </div>
            </div>
          </header>

          <div class="combo-modal__body">
            <!-- 企业会员套餐 -->
            <template v-if="memberTab === 'enterprise'">
              <h2 id="combo-modal-title" class="visually-hidden">会员套餐</h2>
              <div class="combo-modal__plans">
                <article
                  v-for="plan in COMBO_PLANS"
                  :key="plan.id"
                  class="combo-modal__card"
                  :class="{ 'combo-modal__card--featured': plan.featured }"
                >
                  <div class="combo-modal__card-head">
                    <h3 class="combo-modal__card-name">{{ plan.name }}</h3>
                    <span class="combo-modal__discount">{{ plan.discountLabel }}</span>
                  </div>

                  <div class="combo-modal__price-row">
                    <span class="combo-modal__price">
                      ¥ {{ displayPrice(plan) }}
                      <small>{{ priceUnit(plan) }}</small>
                    </span>
                    <span class="combo-modal__original">
                      原价 ¥{{ displayOriginal(plan) }}{{ priceUnit(plan) }}
                    </span>
                  </div>

                  <p class="combo-modal__credits">
                    {{ billing === 'yearly' ? plan.creditsYearly : plan.creditsMonthly }}
                  </p>

                  <ul class="combo-modal__quota">
                    <li v-for="line in plan.quotaLines" :key="line">{{ line }}</li>
                  </ul>

                  <button
                    type="button"
                    class="combo-modal__activate"
                    @click="onActivate(plan.id)"
                  >
                    立即开通
                  </button>

                  <p class="combo-modal__benefits-title">权益说明</p>
                  <ul class="combo-modal__benefits">
                    <li v-for="item in plan.benefits" :key="item">
                      <span class="combo-modal__check" aria-hidden="true" />
                      <span>{{ item }}</span>
                    </li>
                  </ul>
                </article>
              </div>
            </template>

            <!-- 申请试用 -->
            <template v-else>
              <h2 id="combo-modal-title" class="combo-modal__trial-title">申请试用</h2>

              <div class="combo-modal__trial-cards">
                <article
                  v-for="card in TRIAL_FEATURE_CARDS"
                  :key="card.title"
                  class="combo-modal__trial-card"
                >
                  <h3 class="combo-modal__trial-card-title">{{ card.title }}</h3>
                  <p class="combo-modal__trial-card-desc">{{ card.description }}</p>
                </article>
              </div>

              <form class="combo-modal__trial-form" @submit.prevent="submitTrial">
                <label class="combo-modal__field">
                  <span class="combo-modal__label">
                    <span class="combo-modal__required">*</span>手机号码
                  </span>
                  <span class="combo-modal__input-wrap">
                    <span class="combo-modal__dial">+86</span>
                    <input
                      v-model="trialPhone"
                      type="tel"
                      class="combo-modal__input"
                      placeholder="请输入手机号码"
                      maxlength="11"
                      autocomplete="tel"
                    />
                    <span class="combo-modal__counter">{{ trialPhone.length }}/11</span>
                  </span>
                </label>

                <label class="combo-modal__field">
                  <span class="combo-modal__label">
                    <span class="combo-modal__required">*</span>手机验证码
                  </span>
                  <span class="combo-modal__code-wrap">
                    <input
                      v-model="trialCode"
                      type="text"
                      class="combo-modal__input"
                      placeholder="请输入手机验证码"
                      maxlength="6"
                      inputmode="numeric"
                      autocomplete="one-time-code"
                    />
                    <button
                      type="button"
                      class="combo-modal__code-btn"
                      :disabled="trialCodeSending || trialCodeCountdown > 0 || !trialPhoneValid"
                      @click="sendTrialCode"
                    >
                      {{ trialCodeBtnText }}
                    </button>
                  </span>
                </label>

                <label class="combo-modal__field">
                  <span class="combo-modal__label">
                    <span class="combo-modal__required">*</span>称呼
                  </span>
                  <input
                    v-model="trialName"
                    type="text"
                    class="combo-modal__input combo-modal__input--solo"
                    placeholder="请问怎么称呼您"
                    maxlength="32"
                  />
                </label>

                <label class="combo-modal__field">
                  <span class="combo-modal__label">
                    <span class="combo-modal__required">*</span>职位
                  </span>
                  <input
                    v-model="trialPosition"
                    type="text"
                    class="combo-modal__input combo-modal__input--solo"
                    placeholder="请输入职位"
                    maxlength="64"
                  />
                </label>

                <button
                  type="submit"
                  class="combo-modal__trial-submit"
                  :disabled="!canSubmitTrial"
                >
                  立即购买
                </button>
              </form>
            </template>
          </div>

          <footer v-if="memberTab === 'enterprise'" class="combo-modal__footer">
            <p class="combo-modal__personal">
              个人版设计师使用请
              <button type="button" class="combo-modal__personal-link" @click="emit('view-personal')">
                点击查看
              </button>
            </p>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  COMBO_PLANS,
  TRIAL_FEATURE_CARDS,
  type BillingCycle,
  type ComboPlan,
} from './comboData'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  close: []
  activate: [planId: string, billing: BillingCycle]
  'contact-service': []
  'trial-submit': [payload: { phone: string; code: string; name: string; position: string }]
  'send-trial-code': [phone: string]
  'view-personal': []
}>()

const memberTab = ref<'enterprise' | 'trial'>('enterprise')
const billing = ref<BillingCycle>('yearly')

const trialPhone = ref('')
const trialCode = ref('')
const trialName = ref('')
const trialPosition = ref('')
const trialCodeCountdown = ref(0)
const trialCodeSending = ref(false)

let trialCountdownTimer: ReturnType<typeof setInterval> | null = null

const trialPhoneValid = computed(() => /^1\d{10}$/.test(trialPhone.value.trim()))

const canSubmitTrial = computed(
  () =>
    trialPhoneValid.value &&
    /^\d{4,6}$/.test(trialCode.value.trim()) &&
    trialName.value.trim().length > 0 &&
    trialPosition.value.trim().length > 0,
)

const trialCodeBtnText = computed(() => {
  if (trialCodeCountdown.value > 0) return `${trialCodeCountdown.value}s`
  return '发送验证码'
})

function close() {
  open.value = false
  emit('close')
}

function displayPrice(plan: ComboPlan) {
  return billing.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
}

function displayOriginal(plan: ComboPlan) {
  return billing.value === 'yearly' ? plan.yearlyOriginal : plan.monthlyOriginal
}

function priceUnit(plan: ComboPlan) {
  if (billing.value === 'yearly') {
    return plan.priceSuffixYearly ?? '/年'
  }
  return '/月'
}

function onActivate(planId: string) {
  emit('activate', planId, billing.value)
}

function startTrialCountdown(seconds = 60) {
  trialCodeCountdown.value = seconds
  if (trialCountdownTimer) clearInterval(trialCountdownTimer)
  trialCountdownTimer = setInterval(() => {
    trialCodeCountdown.value -= 1
    if (trialCodeCountdown.value <= 0 && trialCountdownTimer) {
      clearInterval(trialCountdownTimer)
      trialCountdownTimer = null
    }
  }, 1000)
}

async function sendTrialCode() {
  if (!trialPhoneValid.value || trialCodeCountdown.value > 0) return
  trialCodeSending.value = true
  emit('send-trial-code', trialPhone.value.trim())
  try {
    await new Promise((resolve) => setTimeout(resolve, 400))
    startTrialCountdown()
  } finally {
    trialCodeSending.value = false
  }
}

function submitTrial() {
  if (!canSubmitTrial.value) return
  emit('trial-submit', {
    phone: trialPhone.value.trim(),
    code: trialCode.value.trim(),
    name: trialName.value.trim(),
    position: trialPosition.value.trim(),
  })
}

function resetTrialForm() {
  trialPhone.value = ''
  trialCode.value = ''
  trialName.value = ''
  trialPosition.value = ''
  trialCodeCountdown.value = 0
  if (trialCountdownTimer) {
    clearInterval(trialCountdownTimer)
    trialCountdownTimer = null
  }
}

function lockBodyScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(open, (visible) => {
  lockBodyScroll(visible)
  if (!visible) {
    memberTab.value = 'enterprise'
    billing.value = 'yearly'
    resetTrialForm()
  }
})

onBeforeUnmount(() => {
  lockBodyScroll(false)
  if (trialCountdownTimer) clearInterval(trialCountdownTimer)
})
</script>

<style scoped lang="scss">
@import './index.scss';

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
