export const USER_INFO_TABS = [
  { key: 'account', label: '账户信息' },
  { key: 'points', label: '积分日志' },
  { key: 'bills', label: '账单' },
  { key: 'notifications', label: '消息通知' },
] as const

export type UserInfoTabKey = (typeof USER_INFO_TABS)[number]['key']

export const USER_MEMBERSHIP_NOTES = [
  '开通会员可获赠 AI 积分。',
  '开通会员可以解锁daone软件的全部功能。',
  'AI 积分用于智能生图等能力，凡涉及 AI 处理的功能都会消耗积分。积分可单独充值。',
]

export const POINTS_LOG_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'INCOME', label: '增加' },
  { key: 'EXPENSE', label: '减少' },
] as const

export type PointsLogFilterKey = (typeof POINTS_LOG_FILTERS)[number]['key']

export type BillItem = {
  id: string
  orderNo: string
  type: string
  status: 'PAID' | 'PENDING' | 'REFUNDED' | 'PAYING' | 'CANCELLED'
  amount: number
  date: string
}

export const BILL_STATUS_LABEL: Record<BillItem['status'], string> = {
  PAID: '已支付',
  PENDING: '待支付',
  PAYING: '支付中',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
}
