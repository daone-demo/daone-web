<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="payment-success"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-success-title"
      @click.self="close"
    >
      <div class="payment-success__dialog">
        <button
          type="button"
          class="payment-success__close"
          aria-label="关闭"
          @click="close"
        >
          ×
        </button>

        <img
          class="payment-success__mascot"
          src="@assets/images/logo_black.png"
          alt=""
          aria-hidden="true"
        />

        <h2 id="payment-success-title" class="payment-success__title">
          您已支付成功
        </h2>

        <p class="payment-success__subtitle">
          <span class="payment-success__check" aria-hidden="true" />
          <span>{{ congratulatePrefix }}</span>
          <span v-if="payload?.productName" class="payment-success__product">
            {{ payload.productName }}
          </span>
        </p>

        <div class="payment-success__card">
          <div v-if="showPoints" class="payment-success__row">
            <span class="payment-success__label">积分</span>
            <span class="payment-success__value">
              {{ pointsText }}
            </span>
          </div>
          <div v-if="payload?.expireDate" class="payment-success__row">
            <span class="payment-success__label">会员有效期</span>
            <span class="payment-success__value">{{ payload.expireDate }}</span>
          </div>
          <div v-if="payload?.orderNo" class="payment-success__row">
            <span class="payment-success__label">订单编号</span>
            <span class="payment-success__value payment-success__order">
              <span class="payment-success__order-no">{{ payload.orderNo }}</span>
              <button
                type="button"
                class="payment-success__copy"
                title="复制订单编号"
                @click="copyOrderNo"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <rect
                    x="5.5"
                    y="5.5"
                    width="8"
                    height="8"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                  />
                  <path
                    d="M3.5 10.5h-1A1.5 1.5 0 0 1 1 9V2.5A1.5 1.5 0 0 1 2.5 1H9a1.5 1.5 0 0 1 1.5 1.5v1"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </span>
          </div>
        </div>

        <button type="button" class="payment-success__ok" @click="close">
          知道了
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import { useModalStore, type PaymentSuccessPayload } from '@stores/useModal'

const modalStore = useModalStore()

const open = computed({
  get: () => modalStore.paymentSuccessVisible,
  set: (value: boolean) => {
    modalStore.paymentSuccessVisible = value
  },
})

const payload = computed(
  () => modalStore.getPayload('paymentSuccess') as PaymentSuccessPayload | undefined,
)

const congratulatePrefix = computed(() => {
  if (payload.value?.kind === 'points') return '恭喜成功充值'
  return '恭喜成功订阅'
})

const showPoints = computed(() => {
  const points = payload.value?.points
  return points != null && Number(points) > 0
})

const pointsText = computed(() => {
  const points = payload.value?.points
  if (points == null) return ''
  const status = payload.value?.pointsStatus?.trim() || '已发放'
  return `${points} ${status}`
})

function close() {
  modalStore.closeModal('paymentSuccess')
}

async function copyOrderNo() {
  const orderNo = payload.value?.orderNo?.trim()
  if (!orderNo) return
  try {
    await navigator.clipboard.writeText(orderNo)
    message.success('订单编号已复制')
  } catch {
    message.error('复制失败，请手动复制')
  }
}
</script>

<style scoped lang="scss">
@use './index.scss' as *;
</style>
