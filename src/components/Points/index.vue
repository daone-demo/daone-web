<template>
  <Teleport to="body">
    <Transition name="points-modal-fade">
      <div
        v-if="open"
        class="points-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-modal-title"
        @mousedown.self="close"
      >
        <div class="points-modal__dialog" @mousedown.stop>
          <button
            type="button"
            class="points-modal__close"
            aria-label="关闭"
            @click="close"
          >
            ×
          </button>

          <h2 id="points-modal-title" class="points-modal__title">Daone积分充值</h2>

          <div class="points-modal__hero">
            <div class="points-modal__orb" aria-hidden="true">
              <span class="points-modal__orb-sparkles" />
            </div>
            <div class="points-modal__balance">
              <span class="points-modal__balance-star" aria-hidden="true" />
              <span class="points-modal__balance-value">{{ availablePoints }}</span>
              <!-- <button
                type="button"
                class="points-modal__balance-link"
                @click="openPointsLog"
              >
                明细&gt;&gt;
              </button> -->
            </div>
          </div>

          <h3 class="points-modal__section-title">Daone积分额度</h3>
          <div class="points-modal__grid" role="listbox" aria-label="选择充值额度">
            <button
              v-for="item in pointRechargePackages"
              :key="item.packageCode"
              type="button"
              role="option"
              class="points-modal__card"
              :class="{ 'points-modal__card--active': selectedPackageId === item.packageCode }"
              :aria-selected="selectedPackageId === item.packageCode"
              @click="selectedPackageId = item.packageCode"
            >
              <span class="points-modal__card-points">
                <span class="points-modal__card-star" aria-hidden="true" />
                + {{ item.grantPoints }}
              </span>
              <span class="points-modal__card-price">¥{{ tools.div(item.priceFen, 100) }}</span>
            </button>
          </div>

          <label class="points-modal__agreement">
            <span
              class="points-modal__checkbox"
              :class="{ 'points-modal__checkbox--checked': agreedToTerms }"
              aria-hidden="true"
            />
            <input
              v-model="agreedToTerms"
              type="checkbox"
              class="visually-hidden"
            />
            <span>
              充值即视为同意
              <button
                type="button"
                class="points-modal__agreement-link"
                @click.stop="openPaidServiceAgreement"
              >
                《付费服务协议》
              </button>
            </span>
          </label>

          <button
            type="button"
            class="points-modal__submit"
            :class="canSubmit ? 'points-modal__submit--active' : 'points-modal__submit--disabled'"
            :disabled="!canSubmit || submitting"
            @click="handleSubmit"
          >
            {{ submitLabel }}
          </button>

          <p class="points-modal__footer">
            购买
            <button type="button" class="points-modal__footer-link" @click="openCombo">
              会员
            </button>
            享受更多权益和积分
          </p>
        </div>
      </div>
    </Transition>

    <Transition name="combo-confirm-fade">
      <div
        v-if="confirmVisible"
        class="combo-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-confirm-title"
        @mousedown.self="closeConfirm"
      >
        <div
          class="combo-confirm__dialog"
          @mousedown.stop
        >
          <button
            type="button"
            class="combo-confirm__close"
            aria-label="关闭"
            @click="closeConfirm"
          >
            ×
          </button>

          <header class="combo-confirm__header">
            <h3 id="points-confirm-title" class="combo-confirm__title">
              {{ confirmPreview.title }}
            </h3>
          </header>

          <section v-if="orderNo" class="combo-confirm__pay">
            <p class="combo-confirm__pay-title">支付方式</p>
            <div
              class="combo-confirm__pay-options"
              role="radiogroup"
              aria-label="支付方式"
            >
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
            <a-flex align="center" justify="center">
              <img
                v-if="payUrl"
                :src="payUrl"
                alt="支付二维码"
                class="combo-confirm__pay-qrcode"
              />
            </a-flex>
          </section>

          <section v-else class="combo-confirm__card">
            <div class="combo-confirm__row">
              <span>充值积分</span>
              <span>+{{ confirmPreview.grantPoints }}</span>
            </div>
            <div class="combo-confirm__row combo-confirm__row--highlight">
              <span>应付金额</span>
              <strong>¥{{ confirmPreview.priceYuan }}</strong>
            </div>
          </section>

          <button
            v-if="!orderNo"
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
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import api from '@/services/api'
import tools from '@/utils/tools'
import { useUserInfo } from '@/stores/useUserInfo'
import { useModalStore } from '@stores/useModal'
import { useNeedReloadPointsStore } from '@stores/useNeedReload';
const needReloadPointsStore = useNeedReloadPointsStore();

interface PointRechargePackage {
  packageCode: string
  grantPoints: number
  priceFen: number
}

interface UserSubscription {
  status?: string
}

interface UserProfile {
  subscription?: UserSubscription | null
  points?: {
    available?: number
    grantedTotal?: number
  }
}

type PayMethod = 'ALIPAY' | 'WECHAT' | 'BANK_TRANSFER'

interface PaymentResponse {
  payType?: string
  qrCodeContent?: string
  redirectUrl?: string
  expireAt?: string
}

const PAYMENT_METHODS: Array<{ key: PayMethod; label: string }> = [
  { key: 'ALIPAY', label: '支付宝' },
  { key: 'WECHAT', label: '微信' },
]

const ORDER_POLLING_INTERVAL = 3000

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  close: []
  recharge: [packageCode: string]
}>()

const router = useRouter()
const userInfoStore = useUserInfo()
const modalStore = useModalStore()

const selectedPackageId = ref('')
const agreedToTerms = ref(false)
const submitting = ref(false)
const userProfile = ref<UserProfile | null>(null)
const currentIdempotencyKey = ref<string | null>(null)
const pointRechargePackages = ref<PointRechargePackage[]>([])

const confirmVisible = ref(false)
const confirmLoading = ref(false)
const selectedPayMethod = ref<PayMethod>('WECHAT')
const orderNo = ref('')
const payUrl = ref('')
const payExpireAt = ref('')

let orderPollingTimer: ReturnType<typeof setInterval> | null = null

const selectedPackage = computed(
  () => pointRechargePackages.value.find((item) => item.packageCode === selectedPackageId.value) ?? null,
)

const availablePoints = computed(
  () => userProfile.value?.points?.available
    ?? userInfoStore.pointAccount?.available
    ?? 0,
)

const hasActiveMembership = computed(
  () => userProfile.value?.subscription?.status === 'ACTIVE',
)

const canSubmit = computed(
  () => hasActiveMembership.value && agreedToTerms.value && Boolean(selectedPackage.value),
)

const submitLabel = computed(() => {
  if (submitting.value) return '处理中...'
  if (!hasActiveMembership.value) return '请先升级会员'
  if (!agreedToTerms.value) return '请先同意协议'
  if (!selectedPackage.value) return '请选择充值额度'
  return `立即充值 ¥${tools.div(selectedPackage.value.priceFen, 100)}`
})

const confirmPreview = computed(() => {
  const pkg = selectedPackage.value
  return {
    title: pkg ? `充值 ${pkg.grantPoints} 积分` : '',
    grantPoints: pkg?.grantPoints ?? 0,
    priceYuan: pkg ? formatYuan(pkg.priceFen) : '0.00',
    productCode: pkg?.packageCode ?? '',
  }
})

const confirmPayLabel = computed(() => {
  if (confirmLoading.value) return '处理中...'
  return `确认支付 ¥${confirmPreview.value.priceYuan}`
})

function formatYuan(fen: number): string {
  return Number(tools.div(fen, 100)).toFixed(2)
}

function close() {
  open.value = false
  emit('close')
}

function closeConfirm() {
  if (confirmLoading.value) return
  stopOrderPolling()
  confirmVisible.value = false
  selectedPayMethod.value = 'WECHAT'
  orderNo.value = ''
  payUrl.value = ''
  payExpireAt.value = ''
}

function lockBodyScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

async function loadPointRechargePackages() {
  try {
    const res: { items?: PointRechargePackage[] } = await api.queryPointRechargePackages()
    pointRechargePackages.value = res.items ?? []
    if (!pointRechargePackages.value.length) return
    const hasSelection = pointRechargePackages.value.some(
      (item) => item.packageCode === selectedPackageId.value,
    )
    if (!hasSelection) {
      selectedPackageId.value = pointRechargePackages.value[0].packageCode
    }
  } catch (error) {
    console.error('loadPointRechargePackages', error)
    pointRechargePackages.value = []
  }
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

function resetForm() {
  selectedPackageId.value = pointRechargePackages.value[0]?.packageCode ?? ''
  agreedToTerms.value = false
  submitting.value = false
  currentIdempotencyKey.value = null
  closeConfirm()
}

function openCombo() {
  close()
  modalStore.openModal('combo')
}

function openPaidServiceAgreement() {
  const { href } = router.resolve({ name: 'pdf', query: { type: 'UserAgreement' } })
  window.open(href, '_blank')
}

async function handleSubmit() {
  if (!canSubmit.value || !selectedPackage.value || submitting.value) return

  if (!userInfoStore.isLoggedIn) {
    close()
    modalStore.openModal('login')
    return
  }
  const res:any = await api.createPointRechargeOrder({
    packageCode: selectedPackage.value.packageCode,
  }, uuidv4())
  orderNo.value = res.orderNo;
  startOrderPolling();
  confirmVisible.value = true;
}

async function confirmPay() {
  if (!selectedPackage.value || confirmLoading.value) return

  const productCode = confirmPreview.value.productCode
  if (!productCode) return

  if (!currentIdempotencyKey.value) {
    currentIdempotencyKey.value = uuidv4()
  }

  confirmLoading.value = true
  try {
    const order = await api.createOrder<{
      orderNo: string
      amountFen: number
    }>(
      {
        orderType: 'POINTS',
        productCode,
      },
      currentIdempotencyKey.value,
    )
    orderNo.value = order.orderNo
    startOrderPolling()
  } catch (error) {
    console.error('confirmPay', error)
    message.error('支付失败，请稍后重试')
  } finally {
    confirmLoading.value = false
  }
}

function queryOrder() {
  if (!orderNo.value) return
  api.getOrder(orderNo.value).then((res: any) => {
    const status = res?.status
    if (status === 'PAID') {
      stopOrderPolling()
      message.success('支付成功')
      emit('recharge', selectedPackageId.value)
      loadUserProfile()
      closeConfirm()
      close()
      needReloadPointsStore.setNeedReloadPoints(true);
    } else if (status === 'REFUNDED') {
      stopOrderPolling()
    }
  }).catch((error) => {
    console.error('queryOrder', error)
  })
}

function startOrderPolling() {
  stopOrderPolling()
  if (!orderNo.value) return
  orderPollingTimer = setInterval(queryOrder, ORDER_POLLING_INTERVAL)
}

function stopOrderPolling() {
  if (orderPollingTimer) {
    clearInterval(orderPollingTimer)
    orderPollingTimer = null
  }
}

async function onLoadPayUrl() {
  try {
    const res = await api.createPayment<PaymentResponse>(orderNo.value, {
      payType: selectedPayMethod.value,
    })
    if (!res) return

    if (selectedPayMethod.value === 'WECHAT') {
      payUrl.value = await QRCode.toDataURL(res.redirectUrl ?? '', {
        width: 260,
        margin: 2,
      })
    } else {
      payUrl.value = res.qrCodeContent ?? ''
    }
    payExpireAt.value = res.expireAt ?? ''
  } catch (error) {
    console.error('onLoadPayUrl', error)
    payUrl.value = ''
  }
}

watch([orderNo, selectedPayMethod], ([no, method]) => {
  if (no && method !== 'BANK_TRANSFER') {
    onLoadPayUrl()
  } else {
    payUrl.value = ''
  }
})

watch(open, (visible) => {
  lockBodyScroll(visible)
  if (visible) {
    loadPointRechargePackages()
    loadUserProfile()
  } else {
    stopOrderPolling()
    resetForm()
  }
})

onBeforeUnmount(() => {
  lockBodyScroll(false)
  stopOrderPolling()
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
