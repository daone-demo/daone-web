import { http, type RequestConfig } from '@/utils/request'
import type { PostSmsLoginRequest, QuerySmsCodeRequest } from '@/types/types'

type JsonObject = Record<string, unknown>
type Id = string

export interface PageQuery {
  page?: number
  pageSize?: number
}

export interface PageResult<T = unknown> {
  records: T[]
  page: number
  pageSize: number
  total: number
}

export interface UserProfileUpdateRequest {
  nickname?: string
  avatarUrl?: string
}

export interface ProjectCreateRequest {
  title: string
}

export interface ProjectUpdateRequest {
  title?: string
}

export interface CanvasSnapshotMeta {
  projectId?: string
  projectName?: string
  canvasBgTheme?: string
  gridVisible?: boolean
  panMode?: boolean
  showMinimap?: boolean
}

export interface CanvasSnapshotViewport {
  zoom?: number
  translateX?: number
  translateY?: number
  scrollLeft?: number
  scrollTop?: number
}

export interface CanvasSnapshotGraph {
  cells?: JsonObject[]
  [key: string]: unknown
}

export interface CanvasSnapshotSummary {
  nodeCount?: number
  edgeCount?: number
}

/** 画布快照，对应接口文档 canvasData 字段。 */
export interface CanvasData {
  version?: number
  savedAt?: string
  meta?: CanvasSnapshotMeta
  viewport?: CanvasSnapshotViewport
  graph?: CanvasSnapshotGraph
  summary?: CanvasSnapshotSummary
}

/** PUT /projects/{projectId}/canvas 请求体。 */
export interface CanvasSaveRequest {
  /** 客户端当前画布版本，用于乐观锁校验。 */
  revision: number
  /** 保存类型，默认 MANUAL。 */
  saveType?: 'MANUAL' | 'AUTO' | string
  /** 画布快照 JSON 数据。 */
  canvasData: CanvasData
}

/** GET /projects/{projectId}/canvas 响应 data。 */
export interface ProjectCanvasResponse {
  projectId: string
  revision: number
  canvasData: CanvasData
  canvas: CanvasData
  updatedAt: string
}

/** PUT /projects/{projectId}/canvas 响应 data。 */
export interface CanvasSaveResponse extends ProjectCanvasResponse {
  savedAt: string
}

export interface ShareCreateRequest {
  expireDays?: number
}

export interface UploadTicketRequest {
  projectId?: Id
  fileName: string
  contentType: string
  fileSize: number
}

export interface AssetCompleteUploadRequest {
  uploadTicket: string
  projectId?: Id
  fileSize: number
}

export interface PointEstimateRequest {
  capabilityCode: string
  parameters?: { count?: number } & JsonObject
}

export interface PromptTranslateRequest {
  text: string
  targetLanguage: string
}

export interface GenerationTaskCreateRequest {
  projectId: Id
  capabilityCode: string
  prompt: string
  parameters?: { count?: number } & JsonObject
  assetIds?: Id[]
}

export interface ChatSessionCreateRequest {
  projectId?: Id
  title?: string
}

export interface ChatMessageCreateRequest {
  content: string
  assetIds?: Id[]
}

export interface WorkflowSaveRequest {
  title?: string
  description?: string
  flowData?: JsonObject
}

export interface WorkflowProjectCreateRequest {
  title: string
}

export interface TrialSmsCodeRequest {
  phone: string
}

export interface TrialApplicationRequest {
  phone: string
  code: string
  contactName: string
  position: string
}

export interface OrderCreateRequest {
  orderType: string
  productCode: string
}

export interface PaymentCreateRequest {
  payType: 'WECHAT' | 'ALIPAY' | string
}

export interface PaymentNotifyRequest {
  orderNo: string
  amountFen: number
  currency: string
  channelTransactionNo?: string
}

export interface AdminUserStatusRequest {
  status: string
}

export interface AdminPointAdjustmentRequest {
  amount: number
  reason: string
}

export interface AdminPlanSaveRequest {
  planCode: string
  planName: string
  benefits?: string[]
  prices: Array<{
    priceCode?: string
    cycleUnit?: 'DAY' | 'MONTH' | 'YEAR' | string
    cycleCount?: number
    priceFen?: number
    originalPriceFen?: number
    grantPoints?: number
  }>
}

export interface AdminPlanStatusRequest {
  status: string
}

export interface AdminModelConfigRequest {
  basePoints?: number
  parameters?: {
    count?: { min?: number; max?: number }
  } & JsonObject
}

export interface AdminModelStatusRequest {
  status: string
}

export interface AdminPromptTemplateSaveRequest {
  code?: string
  name: string
  scenario?: string
  content: string
}

export interface AdminInspirationSaveRequest {
  title?: string
  categoryCode?: string
  coverUrl?: string
  prompt?: string
}

export interface ProjectListQuery extends PageQuery {
  keyword?: string
}

export interface AssetListQuery extends PageQuery {
  scope?: string
  projectId?: Id
  type?: string
  source?: string
  keyword?: string
}

export interface GenerationTaskListQuery extends PageQuery {
  projectId?: Id
  status?: string
}

export interface ChatSessionListQuery extends PageQuery {
  projectId?: Id
}

export interface OrderListQuery extends PageQuery {
  status?: string
}

const pathId = (value: string) => encodeURIComponent(value)

// request.ts 的业务基地址是 /api/v1；后台接口则位于 /api/admin/v1。
const apiRoot = import.meta.env.DEV
  ? '/api'
  : String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/v1\/?$/, '')

const adminConfig = (config?: RequestConfig): RequestConfig => ({
  ...config,
  baseURL: apiRoot,
})

const api = {
  // Auth
  /** 发送登录短信验证码。 */
  querySmsCode(data: QuerySmsCodeRequest) {
    return http.post('/auth/sms-codes', data)
  },
  /** 使用手机号和短信验证码登录。 */
  postSmsLogin<T = unknown>(data: PostSmsLoginRequest) {
    return http.post<T>('/auth/sms-login', data)
  },
  /** 创建微信扫码登录会话，返回二维码会话信息。 */
  createWechatQrSession<T = unknown>() {
    return http.post<T>('/auth/wechat/qr-sessions')
  },
  /** 查询指定微信扫码登录会话的状态。 */
  getWechatQrSession<T = unknown>(ticket: string) {
    return http.get<T>(`/auth/wechat/qr-sessions/${pathId(ticket)}`)
  },
  /** 退出当前账号并使登录凭证失效。 */
  logout() {
    return http.post('/auth/logout')
  },

  // User and points
  /** 获取当前登录用户的信息。 */
  getCurrentUser<T = unknown>() {
    return http.get<T>('/users/me')
  },
  /** 修改当前用户的昵称或头像。 */
  updateCurrentUser<T = unknown>(data: UserProfileUpdateRequest) {
    return http.patch<T>('/users/me', data)
  },
  /** 获取当前用户的积分账户。 */
  getPointsAccount<T = unknown>() {
    return http.get<T>('/points/account')
  },
  /** 分页查询积分流水，可按收支方向筛选。 */
  getPointsLedger<T = unknown>(params?: PageQuery & { direction?: string }) {
    return http.get<PageResult<T>>('/points/ledger', { params })
  },
  /** 获取指定积分流水的详情。 */
  getPointsLedgerDetail<T = unknown>(ledgerId: Id) {
    return http.get<T>(`/points/ledger/${pathId(ledgerId)}`)
  },

  // Projects and canvas
  /** 分页查询项目，可按项目名称关键字筛选。 */
  getProjects<T = unknown>(params?: ProjectListQuery) {
    return http.get<PageResult<T>>('/projects', { params })
  },
  /** 创建项目。 */
  createProject<T = unknown>(data: ProjectCreateRequest) {
    return http.post<T>('/projects', data)
  },
  /** 获取指定项目的详情。 */
  getProject<T = unknown>(projectId: Id) {
    return http.get<T>(`/projects/${pathId(projectId)}`)
  },
  /** 修改指定项目的信息。 */
  updateProject<T = unknown>(projectId: Id, data: ProjectUpdateRequest) {
    return http.patch<T>(`/projects/${pathId(projectId)}`, data)
  },
  /** 删除指定项目。 */
  deleteProject(projectId: Id) {
    return http.delete(`/projects/${pathId(projectId)}`)
  },
  /** 获取指定项目的当前画布数据。 */
  getProjectCanvas(projectId: Id) {
    return http.get<ProjectCanvasResponse>(`/projects/${pathId(projectId)}/canvas`)
  },
  /** 保存指定项目的画布数据。 */
  saveProjectCanvas(projectId: Id, data: CanvasSaveRequest) {
    return http.put<CanvasSaveResponse>(`/projects/${pathId(projectId)}/canvas`, data)
  },
  /** 分页查询指定项目的历史版本。 */
  getProjectVersions<T = unknown>(projectId: Id, params?: PageQuery) {
    return http.get<PageResult<T>>(`/projects/${pathId(projectId)}/versions`, { params })
  },
  /** 获取指定项目历史版本的详情。 */
  getProjectVersion<T = unknown>(projectId: Id, versionId: Id) {
    return http.get<T>(`/projects/${pathId(projectId)}/versions/${pathId(versionId)}`)
  },
  /** 将项目画布恢复到指定历史版本。 */
  restoreProjectVersion<T = unknown>(projectId: Id, versionId: Id) {
    return http.post<T>(`/projects/${pathId(projectId)}/versions/${pathId(versionId)}/restore`)
  },
  /** 创建项目分享链接，可设置有效天数。 */
  createProjectShare<T = unknown>(projectId: Id, data: ShareCreateRequest = {}) {
    return http.post<T>(`/projects/${pathId(projectId)}/shares`, data)
  },
  /** 关闭指定的项目分享。 */
  deleteProjectShare(projectId: Id, shareCode: string) {
    return http.delete(`/projects/${pathId(projectId)}/shares/${pathId(shareCode)}`)
  },
  /** 通过分享码访问公开项目内容。 */
  getShare<T = unknown>(shareCode: string) {
    return http.get<T>(`/shares/${pathId(shareCode)}`)
  },

  // Assets
  /** 分页查询素材，可按归属、项目、类型、来源和关键字筛选。 */
  getAssets<T = unknown>(params?: AssetListQuery) {
    return http.get<PageResult<T>>('/assets', { params })
  },
  /** 文件上传完成后确认上传并创建素材记录。 */
  completeAssetUpload<T = unknown>(data: AssetCompleteUploadRequest) {
    return http.post<T>('/assets', data)
  },
  /** 获取文件直传所需的上传凭证。 */
  createAssetUploadTicket<T = unknown>(data: UploadTicketRequest) {
    return http.post<T>('/assets/upload-tickets', data)
  },
  /** 获取指定素材的详情。 */
  getAsset<T = unknown>(assetId: Id) {
    return http.get<T>(`/assets/${pathId(assetId)}`)
  },
  /** 删除指定素材。 */
  deleteAsset(assetId: Id) {
    return http.delete(`/assets/${pathId(assetId)}`)
  },
  /** 收藏指定素材。 */
  favoriteAsset<T = unknown>(assetId: Id) {
    return http.put<T>(`/assets/${pathId(assetId)}/favorite`)
  },
  /** 取消收藏指定素材。 */
  unfavoriteAsset(assetId: Id) {
    return http.delete(`/assets/${pathId(assetId)}/favorite`)
  },

  // AI and generation
  /** 获取当前可用的 AI 能力列表。 */
  getAiCapabilities<T = unknown>() {
    return http.get<T>('/ai/capabilities')
  },
  /** 获取当前可用的 AI 技能列表。 */
  getAiSkills<T = unknown>() {
    return http.get<T>('/ai/skills')
  },
  /** 根据能力和参数预估本次生成所需积分。 */
  estimateAiPoints<T = unknown>(data: PointEstimateRequest) {
    return http.post<T>('/ai/point-estimates', data)
  },
  /** 将提示词翻译成指定语言。 */
  translatePrompt<T = unknown>(data: PromptTranslateRequest) {
    return http.post<T>('/ai/prompt-translations', data)
  },
  /** 分页查询生成任务，可按项目和任务状态筛选。 */
  getGenerationTasks<T = unknown>(params?: GenerationTaskListQuery) {
    return http.get<PageResult<T>>('/generation-tasks', { params })
  },
  /** 创建 AI 生成任务。 */
  createGenerationTask<T = unknown>(data: GenerationTaskCreateRequest) {
    return http.post<T>('/generation-tasks', data)
  },
  /** 获取指定生成任务的详情和执行状态。 */
  getGenerationTask<T = unknown>(taskId: Id) {
    return http.get<T>(`/generation-tasks/${pathId(taskId)}`)
  },
  /** 取消尚未完成的生成任务。 */
  cancelGenerationTask<T = unknown>(taskId: Id) {
    return http.post<T>(`/generation-tasks/${pathId(taskId)}/cancel`)
  },

  // Chat
  /** 分页查询对话会话，可限定所属项目。 */
  getChatSessions<T = unknown>(params?: ChatSessionListQuery) {
    return http.get<PageResult<T>>('/chat-sessions', { params })
  },
  /** 创建一个新的对话会话。 */
  createChatSession<T = unknown>(data: ChatSessionCreateRequest = {}) {
    return http.post<T>('/chat-sessions', data)
  },
  /** 删除指定对话会话。 */
  deleteChatSession(sessionId: Id) {
    return http.delete(`/chat-sessions/${pathId(sessionId)}`)
  },
  /** 分页查询指定会话的历史消息。 */
  getChatMessages<T = unknown>(sessionId: Id, params?: PageQuery) {
    return http.get<PageResult<T>>(`/chat-sessions/${pathId(sessionId)}/messages`, { params })
  },
  /** 向指定会话发送消息，可附带素材。 */
  createChatMessage<T = unknown>(sessionId: Id, data: ChatMessageCreateRequest) {
    return http.post<T>(`/chat-sessions/${pathId(sessionId)}/messages`, data)
  },

  // Workflows
  /** 分页查询工作流，可按名称关键字筛选。 */
  getWorkflows<T = unknown>(params?: ProjectListQuery) {
    return http.get<PageResult<T>>('/workflows', { params })
  },
  /** 保存一个新的工作流。 */
  createWorkflow<T = unknown>(data: WorkflowSaveRequest) {
    return http.post<T>('/workflows', data)
  },
  /** 获取指定工作流的详情。 */
  getWorkflow<T = unknown>(workflowId: Id) {
    return http.get<T>(`/workflows/${pathId(workflowId)}`)
  },
  /** 修改指定工作流。 */
  updateWorkflow<T = unknown>(workflowId: Id, data: WorkflowSaveRequest) {
    return http.put<T>(`/workflows/${pathId(workflowId)}`, data)
  },
  /** 删除指定工作流。 */
  deleteWorkflow(workflowId: Id) {
    return http.delete(`/workflows/${pathId(workflowId)}`)
  },
  /** 使用指定工作流创建项目。 */
  createProjectFromWorkflow<T = unknown>(workflowId: Id, data: WorkflowProjectCreateRequest) {
    return http.post<T>(`/workflows/${pathId(workflowId)}/projects`, data)
  },

  // Plans, trials, orders and payments
  /** 获取当前可购买的套餐列表。 */
  getPlans<T = unknown>() {
    return http.get<T>('/plans')
  },
  /** 发送试用申请短信验证码。 */
  queryTrialSmsCode(data: TrialSmsCodeRequest) {
    return http.post('/trial-applications/sms-codes', data)
  },
  /** 提交试用申请并创建对应试用订单。 */
  createTrialApplication<T = unknown>(data: TrialApplicationRequest) {
    return http.post<T>('/trial-applications', data)
  },
  /** 分页查询当前用户的订单，可按状态筛选。 */
  getOrders<T = unknown>(params?: OrderListQuery) {
    return http.get<PageResult<T>>('/orders', { params })
  },
  /** 创建套餐订单。 */
  createOrder<T = unknown>(data: OrderCreateRequest) {
    return http.post<T>('/orders', data)
  },
  /** 获取指定订单的详情。 */
  getOrder<T = unknown>(orderNo: string) {
    return http.get<T>(`/orders/${pathId(orderNo)}`)
  },
  /** 为指定订单创建支付单。 */
  createPayment<T = unknown>(orderNo: string, data: PaymentCreateRequest) {
    return http.post<T>(`/orders/${pathId(orderNo)}/payments`, data)
  },
  /** 在本地 Mock 环境中将指定订单标记为支付成功。 */
  mockOrderPaid<T = unknown>(orderNo: string) {
    return http.post<T>(`/orders/${pathId(orderNo)}/mock-paid`)
  },
  /**
   * 处理支付渠道的服务端通知。
   * @param signature 支付通知签名，对应 `X-Daone-Payment-Signature` 请求头。
   */
  notifyPayment<T = unknown>(payType: string, data: PaymentNotifyRequest, signature?: string) {
    return http.post<T>(`/payments/${pathId(payType)}/notify`, data, {
      headers: signature ? { 'X-Daone-Payment-Signature': signature } : undefined,
    })
  },
  /** 取消当前订阅的自动续费。 */
  cancelSubscriptionAutoRenew<T = unknown>() {
    return http.post<T>('/subscriptions/cancel-auto-renew')
  },
  /** 获取首页聚合数据，可按灵感分类筛选。 */
  getHome<T = unknown>(categoryCode?: string) {
    return http.get<T>('/home', { params: categoryCode ? { categoryCode } : undefined })
  },

  

  // Admin
  /** 后台分页查询用户列表。 */
  getAdminUsers<T = unknown>(params?: PageQuery) {
    return http.get<PageResult<T>>('/admin/v1/users', adminConfig({ params }))
  },
  /** 后台修改指定用户的启用状态。 */
  updateAdminUserStatus<T = unknown>(userId: Id, data: AdminUserStatusRequest) {
    return http.patch<T>(`/admin/v1/users/${pathId(userId)}/status`, data, adminConfig())
  },
  /** 后台人工增加或扣减指定用户的积分。 */
  adjustAdminUserPoints<T = unknown>(userId: Id, data: AdminPointAdjustmentRequest) {
    return http.post<T>(`/admin/v1/users/${pathId(userId)}/point-adjustments`, data, adminConfig())
  },
  /** 后台分页查询订单，可按订单状态筛选。 */
  getAdminOrders<T = unknown>(params?: OrderListQuery) {
    return http.get<PageResult<T>>('/admin/v1/orders', adminConfig({ params }))
  },
  /** 后台获取全部套餐配置。 */
  getAdminPlans<T = unknown>() {
    return http.get<T>('/admin/v1/plans', adminConfig())
  },
  /** 后台创建套餐。 */
  createAdminPlan<T = unknown>(data: AdminPlanSaveRequest) {
    return http.post<T>('/admin/v1/plans', data, adminConfig())
  },
  /** 后台修改指定套餐。 */
  updateAdminPlan<T = unknown>(planCode: string, data: AdminPlanSaveRequest) {
    return http.put<T>(`/admin/v1/plans/${pathId(planCode)}`, data, adminConfig())
  },
  /** 后台修改指定套餐的启用状态。 */
  updateAdminPlanStatus<T = unknown>(planCode: string, data: AdminPlanStatusRequest) {
    return http.patch<T>(`/admin/v1/plans/${pathId(planCode)}/status`, data, adminConfig())
  },
  /** 后台获取模型配置列表。 */
  getAdminModelConfigs<T = unknown>() {
    return http.get<T>('/admin/v1/model-configs', adminConfig())
  },
  /** 后台修改指定模型的积分和参数配置。 */
  updateAdminModelConfig<T = unknown>(modelCode: string, data: AdminModelConfigRequest) {
    return http.put<T>(`/admin/v1/model-configs/${pathId(modelCode)}`, data, adminConfig())
  },
  /** 后台修改指定模型的启用状态。 */
  updateAdminModelStatus<T = unknown>(modelCode: string, data: AdminModelStatusRequest) {
    return http.patch<T>(`/admin/v1/model-configs/${pathId(modelCode)}/status`, data, adminConfig())
  },
  /** 后台获取提示词模板列表。 */
  getAdminPromptTemplates<T = unknown>() {
    return http.get<T>('/admin/v1/prompt-templates', adminConfig())
  },
  /** 后台创建提示词模板。 */
  createAdminPromptTemplate<T = unknown>(data: AdminPromptTemplateSaveRequest) {
    return http.post<T>('/admin/v1/prompt-templates', data, adminConfig())
  },
  /** 后台修改指定提示词模板。 */
  updateAdminPromptTemplate<T = unknown>(code: string, data: AdminPromptTemplateSaveRequest) {
    return http.put<T>(`/admin/v1/prompt-templates/${pathId(code)}`, data, adminConfig())
  },
  /** 后台获取灵感内容列表。 */
  getAdminInspirations<T = unknown>() {
    return http.get<T>('/admin/v1/inspirations', adminConfig())
  },
  /** 后台创建灵感内容。 */
  createAdminInspiration<T = unknown>(data: AdminInspirationSaveRequest) {
    return http.post<T>('/admin/v1/inspirations', data, adminConfig())
  },
  /** 后台修改指定灵感内容。 */
  updateAdminInspiration<T = unknown>(id: Id, data: AdminInspirationSaveRequest) {
    return http.put<T>(`/admin/v1/inspirations/${pathId(id)}`, data, adminConfig())
  },
}

export default api
