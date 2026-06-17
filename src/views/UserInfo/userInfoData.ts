export const USER_INFO_TABS = [
  { key: 'account', label: '账户信息' },
  { key: 'points', label: '积分日志' },
  { key: 'bills', label: '账单' },
  { key: 'notifications', label: '消息通知' },
  // { key: 'team', label: '团队管理' },
  // { key: 'login', label: '登录记录' },
] as const

export type UserInfoTabKey = (typeof USER_INFO_TABS)[number]['key']

export const USER_PROFILE = {
  name: '李阳',
  phone: '18958012675',
  plan: '团队协作版',
  memberId: '33456',
  availablePoints: 12003,
  giftedPoints: 12003,
  email: '',
  avatar: 'https://picsum.photos/seed/user-liyang/120/120',
  previousAccount: {
    name: '图库用户2044',
    avatar: 'https://picsum.photos/seed/user-gallery/64/64',
  },
}

export const USER_MEMBERSHIP_NOTES = [
  '开通图库会员可获赠 AI 积分。',
  '图库会员支持在微信小程序使用：分享图库/分享笔记、一键转存、高清下载。',
  '会员权益包含：个人独立展厅、个人笔记、AI 生图存储；支持视频/图片/文字存储，手机端也可使用。',
  'AI 积分用于智能生图与 AI 出图等能力，凡涉及 AI 处理的功能都会消耗积分。积分可单独充值；如不需要手机端存储图库，仅充值积分也可正常使用。',
]

export const POINTS_LOG_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'increase', label: '增加' },
  { key: 'decrease', label: '减少' },
] as const

export type PointsLogFilterKey = (typeof POINTS_LOG_FILTERS)[number]['key']

export type PointsLogItem = {
  id: string
  reason: 'refund' | 'consume'
  action: 'increase' | 'decrease'
  username: string
  change: number
  date: string
}

const pointsLogPattern: Array<{ reason: PointsLogItem['reason']; action: PointsLogItem['action'] }> = [
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
  { reason: 'refund', action: 'increase' },
  { reason: 'consume', action: 'decrease' },
]

export const USER_POINTS_LOG: PointsLogItem[] = pointsLogPattern.map((item, index) => ({
  id: `points-log-${index}`,
  reason: item.reason,
  action: item.action,
  username: '图库用户2044',
  change: 30,
  date: '2026-06-02 21:46:22',
}))

export const POINTS_LOG_REASON_LABEL: Record<PointsLogItem['reason'], string> = {
  refund: '任务退还',
  consume: '任务消费',
}

export const POINTS_LOG_ACTION_LABEL: Record<PointsLogItem['action'], string> = {
  increase: '增加',
  decrease: '减少',
}

export type BillItem = {
  id: string
  orderNo: string
  type: string
  status: 'paid' | 'pending' | 'refunded'
  amount: number
  date: string
}

export const BILL_STATUS_LABEL: Record<BillItem['status'], string> = {
  paid: '已支付',
  pending: '待支付',
  refunded: '已退款',
}

export const USER_BILLS: BillItem[] = [
  {
    id: 'bill-1',
    orderNo: 'BJHY20260504133352RRodZI',
    type: '团队协作版',
    status: 'paid',
    amount: 5999,
    date: '2026-05-04 13:33:52',
  },
]
