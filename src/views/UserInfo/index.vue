<template>
  <div class="user-info">
    <div class="user-info__content">
      <section class="user-info__profile-card">
        <div class="user-info__profile-main">
          <img class="user-info__avatar" :src="profileState.avatar" :alt="profileState.name" />
          <div class="user-info__profile-text">
            <div class="user-info__name-row">
              <h1 class="user-info__name">{{ profileState.name }}</h1>
              <span class="user-info__vip-badge">
                <span class="user-info__vip-icon" aria-hidden="true" />
                VIP
              </span>
              <span class="user-info__plan">{{ USER_PROFILE.plan }}</span>
            </div>
            <p class="user-info__phone">{{ profileState.phone }}</p>
          </div>
        </div>

        <div class="user-info__switch-account">
          <img
            class="user-info__switch-avatar"
            :src="USER_PROFILE.previousAccount.avatar"
            alt=""
            aria-hidden="true"
          />
          <div class="user-info__switch-text">
            <span class="user-info__switch-label">切换前账号</span>
            <span class="user-info__switch-name">{{ USER_PROFILE.previousAccount.name }}</span>
          </div>
        </div>

        <button type="button" class="user-info__edit-btn" @click="openEditProfileModal">
          <span class="user-info__edit-icon" aria-hidden="true" />
          编辑资料
        </button>
      </section>

      <section class="user-info__detail-card">
        <nav class="user-info__tabs" aria-label="账户设置">
          <button
            v-for="tab in USER_INFO_TABS"
            :key="tab.key"
            type="button"
            class="user-info__tab"
            :class="{ 'user-info__tab--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div v-if="activeTab === 'account'" class="user-info__account">
          <div class="user-info__form-grid">
            <div class="user-info__field">
              <label class="user-info__label">会员信息</label>
              <div class="user-info__input">{{ USER_PROFILE.memberId }}</div>
            </div>

            <div class="user-info__field">
              <label class="user-info__label">当前订阅</label>
              <div class="user-info__input user-info__input--with-action">
                <span>{{ USER_PROFILE.plan }}</span>
                <button
                  type="button"
                  class="user-info__upgrade-btn"
                  @click="openComboModal"
                >
                  <span class="user-info__upgrade-icon" aria-hidden="true" />
                  升级
                </button>
              </div>
            </div>

            <div class="user-info__field">
              <label class="user-info__label">可用积分</label>
              <div class="user-info__input user-info__input--with-inline-btn">
                <span>{{ USER_PROFILE.availablePoints.toLocaleString('en-US') }}</span>
                <button 
                  type="button" class="user-info__recharge-btn"
                  @click="openComboModal"
                >
                  <span class="user-info__recharge-icon" aria-hidden="true" />
                  充值
                </button>
              </div>
            </div>

            <div class="user-info__field">
              <label class="user-info__label">赠送积分</label>
              <div class="user-info__input">{{ USER_PROFILE.giftedPoints.toLocaleString('en-US') }}</div>
            </div>

            <div class="user-info__field">
              <label class="user-info__label">手机号</label>
              <div class="user-info__input user-info__input--with-link">
                <span>{{ profileState.phone }}</span>
                <button type="button" class="user-info__link-btn">修改</button>
              </div>
            </div>

            <div class="user-info__field">
              <label class="user-info__label">邮箱</label>
              <div class="user-info__input user-info__input--empty">
                {{ profileState.email || '\u00A0' }}
              </div>
            </div>
          </div>

          <div class="user-info__notes">
            <p v-for="(note, index) in USER_MEMBERSHIP_NOTES" :key="index">{{ note }}</p>
          </div>
        </div>

        <div v-else-if="activeTab === 'points'" class="user-info__points-log">
          <div class="user-info__points-toolbar">
            <h3 class="user-info__points-title">明细</h3>
            <label class="user-info__points-filter">
              <select v-model="pointsFilter" class="user-info__points-select">
                <option
                  v-for="filter in POINTS_LOG_FILTERS"
                  :key="filter.key"
                  :value="filter.key"
                >
                  {{ filter.label }}
                </option>
              </select>
              <span class="user-info__points-select-arrow" aria-hidden="true" />
            </label>
          </div>

          <div class="user-info__points-table-wrap">
            <table class="user-info__points-table">
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col" />
                  <th scope="col">使用人</th>
                  <th scope="col">任务</th>
                  <th scope="col">积分变化</th>
                  <th scope="col">日期</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in filteredPointsLog" :key="item.id">
                  <td>{{ POINTS_LOG_REASON_LABEL[item.reason] }}</td>
                  <td>{{ POINTS_LOG_ACTION_LABEL[item.action] }}</td>
                  <td>{{ item.username }}</td>
                  <td>
                    <button type="button" class="user-info__points-detail-link">详情</button>
                  </td>
                  <td>
                    <strong class="user-info__points-change">
                      {{ item.action === 'increase' ? '+' : '-' }}{{ item.change }}
                    </strong>
                  </td>
                  <td>{{ item.date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="activeTab === 'bills'" class="user-info__bills">
          <div class="user-info__bills-table-wrap">
            <table class="user-info__bills-table">
              <thead>
                <tr>
                  <th scope="col">订单号</th>
                  <th scope="col">类型</th>
                  <th scope="col">状态</th>
                  <th scope="col">金额</th>
                  <th scope="col">日期</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bill in USER_BILLS" :key="bill.id">
                  <td>
                    <div class="user-info__bill-order">
                      <span class="user-info__bill-order-no">{{ bill.orderNo }}</span>
                      <button
                        type="button"
                        class="user-info__bill-copy"
                        title="复制订单号"
                        @click="copyOrderNo(bill.orderNo)"
                      >
                        <span class="user-info__bill-copy-icon" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td>{{ bill.type }}</td>
                  <td>
                    <span class="user-info__bill-status" :class="`user-info__bill-status--${bill.status}`">
                      {{ BILL_STATUS_LABEL[bill.status] }}
                    </span>
                  </td>
                  <td>
                    <strong class="user-info__bill-amount">¥{{ bill.amount.toLocaleString('en-US') }}</strong>
                  </td>
                  <td>{{ bill.date }}</td>
                  <td>
                    <button
                      type="button"
                      class="user-info__bill-action-link"
                      @click="openInvoiceModal(bill.orderNo)"
                    >
                      开票
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="user-info__bills-end">没有更多了</p>
        </div>

        <div v-else class="user-info__placeholder">
          <p>{{ placeholderText }}</p>
        </div>
      </section>
    </div>

    <div v-if="showInvoiceModal" class="user-info__invoice-overlay" @click.self="closeInvoiceModal">
      <div class="user-info__invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
        <header class="user-info__invoice-header">
          <h3 id="invoice-modal-title" class="user-info__invoice-title">申请开票</h3>
          <button type="button" class="user-info__invoice-close" title="关闭" @click="closeInvoiceModal">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form class="user-info__invoice-form" @submit.prevent="submitInvoice">
          <div class="user-info__invoice-field user-info__invoice-field--full">
            <label class="user-info__invoice-label">订单号</label>
            <div class="user-info__invoice-readonly">{{ invoiceOrderNo }}</div>
          </div>

          <div class="user-info__invoice-row">
            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">抬头类型</label>
              <div class="user-info__invoice-type-group">
                <button
                  type="button"
                  class="user-info__invoice-type-btn"
                  :class="{ 'user-info__invoice-type-btn--active': invoiceHeaderType === 'personal' }"
                  @click="invoiceHeaderType = 'personal'"
                >
                  个人
                </button>
                <button
                  type="button"
                  class="user-info__invoice-type-btn"
                  :class="{ 'user-info__invoice-type-btn--active': invoiceHeaderType === 'enterprise' }"
                  @click="invoiceHeaderType = 'enterprise'"
                >
                  企业
                </button>
              </div>
            </div>

            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">单位名称</label>
              <input
                v-model="invoiceForm.unitName"
                class="user-info__invoice-input"
                type="text"
                placeholder="请输入单位名称"
              />
            </div>
          </div>

          <div class="user-info__invoice-row">
            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">纳税人识别号</label>
              <input
                v-model="invoiceForm.taxId"
                class="user-info__invoice-input"
                type="text"
                placeholder="请输入纳税人识别号"
              />
            </div>

            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">联系方式</label>
              <input
                v-model="invoiceForm.contact"
                class="user-info__invoice-input"
                type="text"
                placeholder="请输入联系方式"
              />
            </div>
          </div>

          <div class="user-info__invoice-row">
            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">开户银行</label>
              <input
                v-model="invoiceForm.bankName"
                class="user-info__invoice-input"
                type="text"
                placeholder="请输入开户银行"
              />
            </div>

            <div class="user-info__invoice-field">
              <label class="user-info__invoice-label">银行账号</label>
              <input
                v-model="invoiceForm.bankAccount"
                class="user-info__invoice-input"
                type="text"
                placeholder="请输入银行账号"
              />
            </div>
          </div>

          <div class="user-info__invoice-field user-info__invoice-field--full">
            <label class="user-info__invoice-label">注册地址</label>
            <input
              v-model="invoiceForm.address"
              class="user-info__invoice-input"
              type="text"
              placeholder="请输入注册地址"
            />
          </div>

          <footer class="user-info__invoice-footer">
            <button type="button" class="user-info__invoice-cancel" @click="closeInvoiceModal">取消</button>
            <button type="submit" class="user-info__invoice-submit">申请</button>
          </footer>
        </form>
      </div>
    </div>

    <div v-if="showEditProfileModal" class="user-info__edit-overlay" @click.self="closeEditProfileModal">
      <div class="user-info__edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
        <header class="user-info__edit-header">
          <h3 id="edit-profile-title" class="user-info__edit-title">编辑资料</h3>
          <button type="button" class="user-info__edit-close" title="关闭" @click="closeEditProfileModal">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form class="user-info__edit-form" @submit.prevent="saveEditProfile">
          <div class="user-info__edit-avatar-wrap">
            <img class="user-info__edit-avatar" :src="profileState.avatar" :alt="editProfileForm.nickname" />
          </div>

          <div class="user-info__edit-field">
            <label class="user-info__edit-label">昵称</label>
            <input v-model="editProfileForm.nickname" class="user-info__edit-input" type="text" />
          </div>

          <div class="user-info__edit-field">
            <label class="user-info__edit-label">手机号</label>
            <input v-model="editProfileForm.phone" class="user-info__edit-input" type="text" />
          </div>

          <div class="user-info__edit-field">
            <label class="user-info__edit-label">邮箱</label>
            <input
              v-model="editProfileForm.email"
              class="user-info__edit-input"
              type="email"
              placeholder="请输入邮箱"
            />
          </div>

          <div class="user-info__edit-field">
            <label class="user-info__edit-label">登录密码（留空则不修改）</label>
            <div class="user-info__edit-password-wrap">
              <input
                v-model="editProfileForm.password"
                class="user-info__edit-input user-info__edit-input--password"
                :type="showEditPassword ? 'text' : 'password'"
                placeholder="请输入登录密码"
              />
              <button
                type="button"
                class="user-info__edit-password-toggle"
                :title="showEditPassword ? '隐藏密码' : '显示密码'"
                @click="showEditPassword = !showEditPassword"
              >
                <span
                  class="user-info__edit-password-icon"
                  :class="showEditPassword ? 'user-info__edit-password-icon--hide' : 'user-info__edit-password-icon--show'"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <footer class="user-info__edit-footer">
            <button type="button" class="user-info__edit-cancel" @click="closeEditProfileModal">取消</button>
            <button type="submit" class="user-info__edit-submit">保存</button>
          </footer>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useModalStore } from '@stores/useModal';
import { computed, ref } from 'vue'
import {
  BILL_STATUS_LABEL,
  POINTS_LOG_ACTION_LABEL,
  POINTS_LOG_FILTERS,
  POINTS_LOG_REASON_LABEL,
  USER_BILLS,
  USER_INFO_TABS,
  USER_MEMBERSHIP_NOTES,
  USER_POINTS_LOG,
  USER_PROFILE,
  type PointsLogFilterKey,
  type UserInfoTabKey,
} from './userInfoData'
const modalStore = useModalStore()

type InvoiceHeaderType = 'personal' | 'enterprise'

const activeTab = ref<UserInfoTabKey>('account')
const pointsFilter = ref<PointsLogFilterKey>('all')
const showInvoiceModal = ref(false)
const invoiceOrderNo = ref('')
const invoiceHeaderType = ref<InvoiceHeaderType>('enterprise')
const invoiceForm = ref({
  unitName: '',
  taxId: '',
  contact: '',
  bankName: '',
  bankAccount: '',
  address: '',
})
const profileState = ref({
  name: USER_PROFILE.name,
  phone: USER_PROFILE.phone,
  email: USER_PROFILE.email,
  avatar: USER_PROFILE.avatar,
})
const showEditProfileModal = ref(false)
const showEditPassword = ref(false)
const editProfileForm = ref({
  nickname: '',
  phone: '',
  email: '',
  password: '',
})

const filteredPointsLog = computed(() => {
  if (pointsFilter.value === 'all') {
    return USER_POINTS_LOG
  }
  return USER_POINTS_LOG.filter((item) => item.action === pointsFilter.value)
})

const placeholderText = computed(() => {
  const tab = USER_INFO_TABS.find((item) => item.key === activeTab.value)
  return tab ? `${tab.label}内容即将上线` : '暂无内容'
})

async function copyOrderNo(orderNo: string) {
  try {
    await navigator.clipboard.writeText(orderNo)
  } catch {
    // ignore clipboard errors in unsupported environments
  }
}

function openComboModal() {
  modalStore.openModal('combo')
}

function resetInvoiceForm() {
  invoiceHeaderType.value = 'enterprise'
  invoiceForm.value = {
    unitName: '',
    taxId: '',
    contact: '',
    bankName: '',
    bankAccount: '',
    address: '',
  }
}

function openInvoiceModal(orderNo: string) {
  invoiceOrderNo.value = orderNo
  resetInvoiceForm()
  showInvoiceModal.value = true
}

function closeInvoiceModal() {
  showInvoiceModal.value = false
}

function submitInvoice() {
  closeInvoiceModal()
}

function openEditProfileModal() {
  editProfileForm.value = {
    nickname: profileState.value.name,
    phone: profileState.value.phone,
    email: profileState.value.email,
    password: '',
  }
  showEditPassword.value = false
  showEditProfileModal.value = true
}

function closeEditProfileModal() {
  showEditProfileModal.value = false
}

function saveEditProfile() {
  profileState.value = {
    ...profileState.value,
    name: editProfileForm.value.nickname.trim() || profileState.value.name,
    phone: editProfileForm.value.phone.trim() || profileState.value.phone,
    email: editProfileForm.value.email.trim(),
  }
  closeEditProfileModal()
}
</script>

<style scoped lang="scss">
@import './index.scss';
</style>
