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
    
  </Teleport>
  
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { v4 as uuidv4 } from 'uuid'
import api from '@/services/api'
import tools from '@/utils/tools';
import { useUserInfo } from '@/stores/useUserInfo'
import { useModalStore } from '@stores/useModal'
import { POINTS_PACKAGES } from './pointsData'

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

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  close: []
  recharge: [packageId: string]
}>()

const router = useRouter()
const userInfoStore = useUserInfo()
const modalStore = useModalStore()

const selectedPackageId = ref(POINTS_PACKAGES[0]?.id ?? '')
const agreedToTerms = ref(false)
const submitting = ref(false)
const userProfile = ref<UserProfile | null>(null)
const currentIdempotencyKey = ref<string | null>(null)
const pointRechargePackages = ref<any[]>([])

const selectedPackage = computed(
  () => POINTS_PACKAGES.find((item) => item.id === selectedPackageId.value) ?? null,
)

const availablePoints = computed(
  () => userProfile.value?.points?.available
    ?? userInfoStore.pointAccount?.available
    ?? 0,
)

const hasActiveMembership = computed(
  () => userProfile.value?.subscription?.status === "ACTIVE",
)

const canSubmit = computed(
  () => hasActiveMembership.value && agreedToTerms.value && Boolean(selectedPackage.value),
)

const submitLabel = computed(() => {
  if (submitting.value) return '处理中...'
  if (!hasActiveMembership.value) return '请先升级会员'
  if (!agreedToTerms.value) return '请先同意协议'
  if (!selectedPackage.value) return '请选择充值额度'
  return `立即充值 ¥${selectedPackage.value.priceYuan}`
})

function close() {
  open.value = false
  emit('close')
}

function lockBodyScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

async function loadPointRechargePackages() {
  const res:any = await api.queryPointRechargePackages()
  // POINTS_PACKAGES.value = res
  console.log(res)
  pointRechargePackages.value = res.items;
  console.log(pointRechargePackages.value)
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
  selectedPackageId.value = POINTS_PACKAGES[0]?.id ?? ''
  agreedToTerms.value = false
  submitting.value = false
  currentIdempotencyKey.value = null
}

function openPointsLog() {
  close()
  router.push({ name: 'userInfo', query: { tab: 'points' } })
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

  if (!currentIdempotencyKey.value) {
    currentIdempotencyKey.value = uuidv4()
  }

  submitting.value = true
  try {
    await api.createOrder(
      {
        orderType: 'POINTS',
        productCode: selectedPackage.value.productCode,
      },
      currentIdempotencyKey.value,
    )
    message.success('订单已创建，请完成支付')
    emit('recharge', selectedPackage.value.id)
    await loadUserProfile()
  } catch (error) {
    console.error('points recharge', error)
    message.error('充值失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

watch(open, (visible) => {
  lockBodyScroll(visible)
  if (visible) {
    loadPointRechargePackages();
    loadUserProfile();
  } else {
    resetForm()
  }
})

onBeforeUnmount(() => {
  lockBodyScroll(false)
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
