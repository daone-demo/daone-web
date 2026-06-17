export type BillingCycle = 'yearly' | 'monthly'
export type MemberTab = 'enterprise' | 'trial'

export interface TrialFeatureCard {
  title: string
  description: string
}

export const TRIAL_FEATURE_CARDS: TrialFeatureCard[] = [
  {
    title: '试用权限体验',
    description: '99元全功能试用，5天试用时间，赠送3000积分。',
  },
  {
    title: '专属指导服务',
    description: '协助完成账号开通、功能熟悉和试用流程配置。',
  },
  {
    title: '方案配置建议',
    description: '根据人数、图片量、视频量和积分消耗推荐套餐。',
  },
]

export interface ComboPlan {
  id: string
  name: string
  discountLabel: string
  yearlyPrice: number
  yearlyOriginal: number
  monthlyPrice: number
  monthlyOriginal: number
  /** 企业版等特殊计价单位 */
  priceSuffixYearly?: string
  creditsYearly: string
  creditsMonthly: string
  quotaLines: string[]
  benefits: string[]
  featured?: boolean
}

export const COMBO_PLANS: ComboPlan[] = [
  {
    id: 'team',
    name: '团队协作版',
    discountLabel: '7.5折',
    yearlyPrice: 5999,
    yearlyOriginal: 7999,
    monthlyPrice: 699,
    monthlyOriginal: 899,
    creditsYearly: '12000 积分/年',
    creditsMonthly: '1000 积分/月',
    quotaLines: [
      '约 3667 张 大模型生图',
      '约 11000 次 局部修改',
      '约 2400 秒 视频生成',
      '约 12000 次 智能抠图',
    ],
    benefits: [
      '续费积分可结转',
      '未用完积分不过期',
      'Agent 智能体 1200万 token/年',
      '实时渲染生图 12000 张/年',
      '实用工具免费使用（美化、编辑、内容创作、视频处理）',
      '3 人成员协作',
      '150G 存储空间',
      '免费小程序图库',
      '手机端 AI 使用 12000 次/年',
      '商用授权、无限并发任务',
      '画布协作、模型加速',
    ],
  },
  {
    id: 'team-plus',
    name: '团队Plus版',
    discountLabel: '7.5折',
    yearlyPrice: 8999,
    yearlyOriginal: 11999,
    monthlyPrice: 999,
    monthlyOriginal: 1299,
    creditsYearly: '30000 积分/年',
    creditsMonthly: '2500 积分/月',
    quotaLines: [
      '约 8333 张 大模型生图',
      '约 25000 次 局部修改',
      '约 6000 秒 视频生成',
      '约 30000 次 智能抠图',
    ],
    benefits: [
      '续费积分可结转',
      '未用完积分不过期',
      'Agent 智能体 3000万 token/年',
      '实时渲染生图 30000 张/年',
      '实用工具免费使用（美化、编辑、内容创作、视频处理）',
      '5 人成员协作',
      '200G 存储空间',
      '免费小程序图库',
      '手机端 AI 使用 30000 次/年',
      '商用授权、无限并发任务',
      '画布协作、模型加速',
    ],
  },
  {
    id: 'team-max',
    name: '团队Max版',
    discountLabel: '7.2折',
    yearlyPrice: 12999,
    yearlyOriginal: 17999,
    monthlyPrice: 1399,
    monthlyOriginal: 1899,
    creditsYearly: '60000 积分/年',
    creditsMonthly: '5000 积分/月',
    quotaLines: [
      '约 15000 张 大模型生图',
      '约 45000 次 局部修改',
      '约 12000 秒 视频生成',
      '约 60000 次 智能抠图',
    ],
    benefits: [
      '续费积分可结转',
      '未用完积分不过期',
      'Agent 智能体 6000万 token/年',
      '实时渲染生图 60000 张/年',
      '实用工具免费使用（美化、编辑、内容创作、视频处理）',
      '10 人成员协作',
      '300G 存储空间',
      '免费小程序图库',
      '手机端 AI 使用 60000 次/年',
      '商用授权、无限并发任务',
      '画布协作、模型加速',
    ],
  },
  {
    id: 'enterprise',
    name: '企业版',
    discountLabel: '3.75折',
    yearlyPrice: 29999,
    yearlyOriginal: 39999,
    monthlyPrice: 2999,
    monthlyOriginal: 3999,
    priceSuffixYearly: '/2年',
    creditsYearly: '120000 积分/2年',
    creditsMonthly: '10000 积分/月',
    quotaLines: [
      '约 26666 张 大模型生图',
      '约 80000 次 局部修改',
      '约 24000 秒 视频生成',
      '约 120000 次 智能抠图',
    ],
    benefits: [
      '续费积分可结转',
      '未用完积分不过期',
      'Agent 智能体 1.2亿 token/2年',
      '实时渲染生图 120000 张/2年',
      '实用工具免费使用（美化、编辑、内容创作、视频处理）',
      '20 人成员协作',
      '500G 存储空间',
      '免费小程序图库',
      '手机端 AI 使用 120000 次/2年',
      '商用授权、无限并发任务',
      '画布协作、模型加速',
      '1 对 1 专属服务',
      '上门服务',
      '员工 AI 培训',
    ],
    featured: true,
  },
]
