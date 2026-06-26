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
                  :class="{ 'combo-modal__billing-btn--active': billing === 'YEAR' }"
                  @click="billing = 'YEAR'"
                >
                  年付
                  <span v-if="billing === 'YEAR'" class="combo-modal__billing-badge">最高 3.75 折</span>
                </button>
                <button
                  type="button"
                  class="combo-modal__billing-btn"
                  :class="{ 'combo-modal__billing-btn--active': billing === 'MONTH' }"
                  @click="billing = 'MONTH'"
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
                  v-for="plan in plansList.filter(plan => plan.cycleUnit === billing)"
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
                      ¥ {{ tools.div(plan.priceFen, 100) }}
                      <small>元</small>
                    </span>
                    <span class="combo-modal__original">
                      原价 ¥{{ tools.div(plan.originalPriceFen, 100) }}元
                    </span>
                  </div>

                  <p class="combo-modal__credits">
                    {{ billing === 'YEAR' ? plan.creditsYearly : plan.creditsMonthly }}
                  </p>

                  <ul class="combo-modal__quota">
                    <li v-for="line in plan.quotaLines" :key="line">{{ line }}</li>
                  </ul>

                  <button
                    type="button"
                    class="combo-modal__activate"
                    @click="onActivate(plan)"
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

    <Transition name="combo-confirm-fade">
      <div
        v-if="confirmVisible"
        class="combo-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-confirm-title"
        @mousedown.self="closeConfirm"
      >
        <div class="combo-confirm__dialog" @mousedown.stop>
          <button
            type="button"
            class="combo-confirm__close"
            aria-label="关闭"
            @click="closeConfirm"
          >
            ×
          </button>

          <header class="combo-confirm__header">
            <h3 id="combo-confirm-title" class="combo-confirm__title">
              {{ confirmPreview.title }}
            </h3>
            <p v-if="confirmPreview.originalPlanLabel" class="combo-confirm__subtitle">
              原订阅会员：{{ confirmPreview.originalPlanLabel }}
            </p>
          </header>
          <section class="combo-confirm__pay" v-if="orderNo">
            <p class="combo-confirm__pay-title">支付方式</p>
            <div class="combo-confirm__pay-options" role="radiogroup" aria-label="支付方式">
              <button
                v-for="method in PAYMENT_METHODS"
                :key="method.key"
                type="button"
                role="radio"
                class="combo-confirm__pay-option"
                :class="{ 'combo-confirm__pay-option--active': selectedPayMethod === method.key }"
                :aria-checked="selectedPayMethod === method.key"
                @click="selectedPayMethod = method.key"
              >
                <span
                  class="combo-confirm__pay-icon"
                  :class="`combo-confirm__pay-icon--${method.key.toLowerCase()}`"
                  aria-hidden="true"
                />
                <span class="combo-confirm__pay-label">{{ method.label }}</span>
              </button>
            </div>
            <img
              v-if="payUrl"
              :src="payUrl"
              alt="支付二维码"
              class="combo-confirm__pay-qrcode"
            />
            <p v-if="selectedPayMethod === 'BANK_TRANSFER'" class="combo-confirm__pay-tip">
              提交后客服将与您联系并提供对公转账账户信息
            </p>
          </section>
          <section v-else>
            <section class="combo-confirm__card">
              <div class="combo-confirm__row">
                <span>原会员实付</span>
                <span>¥{{ confirmPreview.originalPaidYuan }}</span>
              </div>
              <div class="combo-confirm__row">
                <span>目标会员标价</span>
                <span>¥{{ confirmPreview.targetPriceYuan }}</span>
              </div>
              <div class="combo-confirm__row combo-confirm__row--highlight">
                <span>应付差价</span>
                <strong>¥{{ confirmPreview.payDiffYuan }}</strong>
              </div>
            </section>
            <section class="combo-confirm__card">
              <div class="combo-confirm__row">
                <span>生效时间</span>
                <span>立即生效</span>
              </div>
              <div class="combo-confirm__row">
                <span>有效期</span>
                <span>{{ confirmPreview.validityRange }}</span>
              </div>
              <div class="combo-confirm__row">
                <span>目标会员月度积分</span>
                <span>{{ confirmPreview.targetGrantPoints }}</span>
              </div>
              <div class="combo-confirm__row">
                <span>原会员已消耗积分</span>
                <span>{{ confirmPreview.consumedPoints }}</span>
              </div>
              <div class="combo-confirm__row">
                <span>实际到账积分</span>
                <span>{{ confirmPreview.actualGrantPoints }}</span>
              </div>
            </section>
            <ul class="combo-confirm__notes">
              <li>应付差价按目标会员标价与原会员实付金额计算</li>
              <li>实际到账积分按目标会员月度积分与原会员已消耗积分计算</li>
              <li>升级后立即生效，有效期按新会员周期重新计算</li>
              <li>升级后原会员模型折扣与赠送权益将终止，新会员权益即时生效</li>
            </ul>
          </section>
          <button
            type="button"
            class="combo-confirm__submit"
            :disabled="confirmLoading"
            @click="confirmPay"
          >
            {{ confirmPayLabel }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  TRIAL_FEATURE_CARDS,
  type BillingCycle,
} from './comboData'
import api from '@/services/api';
import tools from '@/utils/tools';
import { message } from 'ant-design-vue';
import { useUserInfo } from '@/stores/useUserInfo';
import { useModalStore } from '@stores/useModal';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

interface PlanItem {
  code: string
  id?: string
  name: string
  cycleUnit: string
  cycleCount?: number
  priceFen: number
  originalPriceFen: number
  grantPoints: number
  benefits?: string[]
  discountLabel?: string
  creditsYearly?: string
  creditsMonthly?: string
  quotaLines?: string[]
  featured?: boolean
}

interface UserSubscription {
  priceCode?: string
  status?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
}

interface UserProfile {
  subscription?: UserSubscription | null
  points?: {
    available?: number
    grantedTotal?: number
  }
}

type PayMethod = 'ALIPAY' | 'WECHAT' | 'BANK_TRANSFER'

const PAYMENT_METHODS: Array<{ key: PayMethod; label: string }> = [
  { key: 'ALIPAY', label: '支付宝' },
  { key: 'WECHAT', label: '微信' },
  { key: 'BANK_TRANSFER', label: '对公转账' },
]

const open = defineModel<boolean>('open', { default: false })
const plansList = ref<PlanItem[]>([])
const userInfoStore = useUserInfo()
const modalStore = useModalStore()
const currentIdempotencyKey = ref<string | null>(null);

const emit = defineEmits<{
  close: []
  activate: [planId: string, billing: BillingCycle]
  'contact-service': []
  'trial-submit': [payload: { phone: string; code: string; name: string; position: string }]
  'send-trial-code': [phone: string]
  'view-personal': []
}>()

const memberTab = ref<'enterprise' | 'trial'>('enterprise')
const billing = ref<BillingCycle>('YEAR')

const confirmVisible = ref(false)
const confirmLoading = ref(false)
const selectedPlan = ref<PlanItem | null>(null)
const userProfile = ref<UserProfile | null>(null)
const selectedPayMethod = ref<PayMethod>('WECHAT')

const trialPhone = ref('')
const trialCode = ref('')
const trialName = ref('')
const trialPosition = ref('')
const trialCodeCountdown = ref(0)
const trialCodeSending = ref(false)
const orderNo = ref('');
const payUrl = ref('');
const payExpireAt = ref('');

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

function formatYuan(fen: number): string {
  return Number(tools.div(fen, 100)).toFixed(2)
}

function getCycleLabel(plan: PlanItem): string {
  if (plan.cycleUnit === 'YEAR') {
    return plan.cycleCount && plan.cycleCount > 1 ? `连续包${plan.cycleCount}年` : '连续包年'
  }
  if (plan.cycleUnit === 'MONTH') return '连续包月'
  if (plan.cycleUnit === 'DAY') return `${plan.cycleCount || 5}天`
  return '会员'
}

function formatDateText(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

function getValidityRange(plan: PlanItem): string {
  const start = new Date()
  const end = new Date(start)

  if (plan.cycleUnit === 'YEAR') {
    end.setFullYear(end.getFullYear() + (plan.cycleCount || 1))
  } else if (plan.cycleUnit === 'MONTH') {
    end.setMonth(end.getMonth() + (plan.cycleCount || 1))
  } else if (plan.cycleUnit === 'DAY') {
    end.setDate(end.getDate() + (plan.cycleCount || 5))
  }

  return `${formatDateText(start)} 至 ${formatDateText(end)}`
}

function findPlanByPriceCode(priceCode?: string): PlanItem | undefined {
  if (!priceCode) return undefined
  return plansList.value.find((item) => item.code === priceCode)
}

const confirmPreview = computed(() => {
  const plan = selectedPlan.value
  const subscription = userProfile.value?.subscription
  const currentPlan = findPlanByPriceCode(subscription?.priceCode)
  const hasActiveSubscription = subscription?.status === 'ACTIVE' && Boolean(currentPlan)

  const targetPriceFen = plan?.priceFen ?? 0
  const originalPaidFen = hasActiveSubscription ? (currentPlan?.priceFen ?? 0) : 0
  const payDiffFen = Math.max(0, targetPriceFen - originalPaidFen)

  const grantedTotal = userProfile.value?.points?.grantedTotal ?? 0
  const available = userProfile.value?.points?.available ?? 0
  const consumedPoints = hasActiveSubscription ? Math.max(0, grantedTotal - available) : 0
  const targetGrantPoints = plan?.grantPoints ?? 0
  const actualGrantPoints = Math.max(0, targetGrantPoints - consumedPoints)

  const cycleLabel = plan ? getCycleLabel(plan) : ''
  const currentCycleLabel = currentPlan ? getCycleLabel(currentPlan) : ''

  return {
    title: plan
      ? hasActiveSubscription
        ? `升级至 ${plan.name} ${cycleLabel}`
        : `开通 ${plan.name} ${cycleLabel}`
      : '',
    originalPlanLabel: hasActiveSubscription && currentPlan
      ? `${currentPlan.name} ${currentCycleLabel}`
      : '',
    originalPaidYuan: formatYuan(originalPaidFen),
    targetPriceYuan: formatYuan(targetPriceFen),
    payDiffYuan: formatYuan(payDiffFen),
    validityRange: plan ? getValidityRange(plan) : '',
    targetGrantPoints,
    consumedPoints,
    actualGrantPoints,
    payDiffFen,
    productCode: plan?.code ?? plan?.id ?? '',
  }
})

const confirmPayLabel = computed(() => {
  if (confirmLoading.value) return '处理中...'
  if (selectedPayMethod.value === 'BANK_TRANSFER') {
    return '提交对公转账申请'
  }
  return `确认支付 ¥${confirmPreview.value.payDiffYuan}`
})

function closeConfirm() {
  if (confirmLoading.value) return
  confirmVisible.value = false
  selectedPlan.value = null
  selectedPayMethod.value = 'WECHAT'
}

async function loadUserProfile() {
  if (!userInfoStore.isLoggedIn) {
    userProfile.value = null
    return
  }

  try {
    const res = await api.getCurrentUser<UserProfile>()
    userProfile.value = res
    if (res.points) {
      userInfoStore.setPointAccount({
        available: res.points.available ?? 0,
        frozen: 0,
        grantedTotal: res.points.grantedTotal ?? 0,
      })
    }
  } catch {
    userProfile.value = null
  }
}

const onloadPlans = async () => {
  const res = await api.getPlans<{ items?: PlanItem[] }>()
  plansList.value = res.items || []
}

async function onActivate(plan: PlanItem) {
  if (!userInfoStore.isLoggedIn) {
    modalStore.openModal('login')
    return
  };
  await loadUserProfile()
  selectedPlan.value = plan
  confirmVisible.value = true;
}

async function confirmPay() {
  if (!selectedPlan.value || confirmLoading.value) return

  const productCode = confirmPreview.value.productCode
  
  if (!productCode) return
  if (!currentIdempotencyKey.value) {
    currentIdempotencyKey.value = uuidv4();
  }

  confirmLoading.value = true
  try {
    // api.createOrder({
    //   orderType: 'PLAN',
    //   productCode,
    // }).then((res:any)=>{
    //   console.log('confirmPay', res)
    //   orderNo.value = res.orderNo;
    // })
    const order = await api.createOrder<{
      orderNo: string
      amountFen: number
    }>(
      {
        orderType: 'PLAN',
        productCode,
      },
      currentIdempotencyKey.value
    )
    console.log('order', order);
    orderNo.value = order.orderNo;

    // if (selectedPayMethod.value === 'BANK_TRANSFER') {
    //   message.success('订单已提交，客服将联系您办理对公转账')
    //   emit('activate', productCode, billing.value)
    //   closeConfirm()
    //   close()
    //   return
    // }

    // await api.createPayment(order.orderNo, { payType: selectedPayMethod.value })
    // await api.mockOrderPaid(order.orderNo)

    // message.success('支付成功')
    // emit('activate', productCode, billing.value)
    // closeConfirm()
    // close()
  } catch (error) {
    console.error('confirmPay', error)
    message.error('支付失败，请稍后重试')
  } finally {
    confirmLoading.value = false
  }
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
  try {
    await api.queryTrialSmsCode({ phone: trialPhone.value.trim() })
    startTrialCountdown()
  } finally {
    trialCodeSending.value = false
  }
}

function submitTrial() {
  if (!canSubmitTrial.value) return
  api.createTrialApplication({
    phone: trialPhone.value.trim(),
    code: trialCode.value.trim(),
    contactName: trialName.value.trim(),
    position: trialPosition.value.trim(),
  }).then((res:any)=>{
    console.log('submitTrial', res)
    message.success('操作成功');
    close()
  })
  .catch((err:any)=>{
    console.error('submitTrial', err)
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
  if (visible) {
    onloadPlans()
  } else {
    orderNo.value = '';
    selectedPayMethod.value = 'WECHAT';
    closeConfirm()
    memberTab.value = 'enterprise'
    billing.value = 'YEAR'
    resetTrialForm()
  }
});

interface PaymentResponse {
  payType?: string
  qrCodeContent?: string
  redirectUrl?: string
  expireAt?: string
}

const onLoadPayUrl = async () => {
  try {
    const res = await api.createPayment<PaymentResponse>(orderNo.value, {
      payType: selectedPayMethod.value,
    })
    if (!res) return

    if (res.redirectUrl) {
      payUrl.value = await QRCode.toDataURL(res.redirectUrl, {
        width: 260,
        margin: 2,
      })
    } else if (res.qrCodeContent) {
      payUrl.value = await QRCode.toDataURL(res.qrCodeContent, {
        width: 260,
        margin: 2,
      })
    }
    payExpireAt.value = res.expireAt ?? ''
  } catch (error) {
    console.error('onLoadPayUrl', error)
    payUrl.value = ''
  }
}

watch([orderNo, selectedPayMethod], ([no, method]) => {
  if (no && method !== 'BANK_TRANSFER') {
    onLoadPayUrl();
  } else {
    payUrl.value = '';
  }
});

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
