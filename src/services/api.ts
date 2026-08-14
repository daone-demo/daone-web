import {
  getToken,
  http,
  removeToken,
  type RequestConfig,
} from '@/utils/request'
import type { PostSmsLoginRequest, QuerySmsCodeRequest } from '@/types/types'

/**
 * uni.request 全局拦截器所需的最小类型。
 *
 * 当前项目是 Web/Vite 工程，没有引入 @dcloudio/types，因此这里不直接依赖
 * UniApp 命名空间，保证 Web 构建和 uni-app 复用时都能通过类型检查。
 */
interface UniRequestOptions {
  url: string
  header?: Record<string, string>
  timeout?: number
  [key: string]: unknown
}

interface UniRequestResponse {
  statusCode: number
  data?: unknown
  [key: string]: unknown
}

interface UniRequestInterceptor {
  invoke?: (options: UniRequestOptions) => UniRequestOptions | void
  success?: (response: UniRequestResponse) => UniRequestResponse | void
  fail?: (error: unknown) => void
}

interface UniRuntime {
  addInterceptor(
    method: 'request',
    interceptor: UniRequestInterceptor,
  ): void
  removeInterceptor?: (method: 'request', interceptor: UniRequestInterceptor) => void
  showToast?: (options: { title: string; icon?: 'none' | 'success'; duration?: number }) => void
  reLaunch?: (options: { url: string }) => void
  getStorageSync?: (key: string) => unknown
  removeStorageSync?: (key: string) => void
}

export interface UniRequestInterceptorOptions {
  /** 接口地址前缀，默认读取 VITE_API_BASE_URL。 */
  baseURL?: string
  /** 请求超时时间，默认读取 VITE_HTTP_TIMEOUT，兜底 60 秒。 */
  timeout?: number
  /** 不携带 Token 的接口。 */
  publicPaths?: Array<string | RegExp>
  /** 登录失效后的页面地址；不传则只清理 Token。 */
  loginPage?: string
  /** 自定义登录失效处理。 */
  onUnauthorized?: () => void
  /** 自定义错误提示；传入空函数可关闭默认 Toast。 */
  onError?: (message: string, response?: UniRequestResponse) => void
}

let uniRequestInterceptorInstalled = false
let installedUniInterceptor: UniRequestInterceptor | null = null
const UNI_TOKEN_KEY = 'daone_token'

function getUniRuntime(): UniRuntime | null {
  const runtime = (globalThis as typeof globalThis & { uni?: UniRuntime }).uni
  return runtime?.addInterceptor ? runtime : null
}

function getCrossPlatformToken(uniRuntime: UniRuntime): string | null {
  try {
    return getToken()
  } catch {
    const token = uniRuntime.getStorageSync?.(UNI_TOKEN_KEY)
    return typeof token === 'string' && token ? token : null
  }
}

function removeCrossPlatformToken(uniRuntime: UniRuntime): void {
  try {
    removeToken()
  } catch {
    uniRuntime.removeStorageSync?.(UNI_TOKEN_KEY)
  }
}

function isAbsoluteUrl(url: string): boolean {
  return /^(?:https?:)?\/\//i.test(url)
}

function joinUrl(baseURL: string, url: string): string {
  if (!baseURL || isAbsoluteUrl(url)) return url
  return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
}

function matchesPublicPath(url: string, paths: Array<string | RegExp>): boolean {
  return paths.some((path) => (
    typeof path === 'string' ? url.includes(path) : path.test(url)
  ))
}

function getUniResponseMessage(response: UniRequestResponse): string {
  if (response.data == null || typeof response.data !== 'object') return ''
  const payload = response.data as Record<string, unknown>
  return String(payload.message ?? payload.msg ?? payload.errmsg ?? '')
}

/**
 * 安装 uni.request 全局拦截器。
 *
 * 建议在 uni-app 的 main.ts 中、应用挂载前调用一次：
 * `installUniRequestInterceptor({ loginPage: '/pages/login/index' })`。
 * 重复调用不会重复注册；函数返回卸载方法，便于测试或微前端销毁。
 */
export function installUniRequestInterceptor(
  options: UniRequestInterceptorOptions = {},
): () => void {
  const uniRuntime = getUniRuntime()
  if (!uniRuntime || uniRequestInterceptorInstalled) return () => undefined

  // const baseURL = options.baseURL ?? import.meta.env.VITE_API_BASE_URL ?? ''
  const baseURL = '/api/api/v1'
  const timeout = options.timeout ?? (Number(import.meta.env.VITE_HTTP_TIMEOUT) || 60_000)
  const publicPaths = options.publicPaths ?? [
    /\/auth\/sms-codes(?:\?|$)/,
    /\/auth\/sms-login(?:\?|$)/,
    /\/auth\/wechat\/qr-sessions(?:\/|\?|$)/,
  ]
  const showError = options.onError ?? ((message: string) => {
    uniRuntime.showToast?.({ title: message, icon: 'none', duration: 2500 })
  })

  installedUniInterceptor = {
    invoke(requestOptions) {
      requestOptions.url = joinUrl(baseURL, requestOptions.url)
      requestOptions.timeout ??= timeout
      requestOptions.header = {
        'Content-Type': 'application/json',
        ...requestOptions.header,
      }

      const token = getCrossPlatformToken(uniRuntime)
      if (token && !matchesPublicPath(requestOptions.url, publicPaths)) {
        requestOptions.header.Authorization = `Bearer ${token}`
      }
      return requestOptions
    },
    success(response) {
      const message = getUniResponseMessage(response)
      if (response.statusCode === 401) {
        removeCrossPlatformToken(uniRuntime)
        if (options.onUnauthorized) {
          options.onUnauthorized()
        } else if (options.loginPage) {
          uniRuntime.reLaunch?.({ url: options.loginPage })
        }
        showError(message || '登录已失效，请重新登录', response)
      } else if (response.statusCode < 200 || response.statusCode >= 300) {
        showError(message || `请求失败 (${response.statusCode})`, response)
      }
      return response
    },
    fail(error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      showError(/timeout/i.test(message) ? '请求超时，请稍后重试' : '网络异常，请检查网络连接')
    },
  }

  uniRuntime.addInterceptor('request', installedUniInterceptor)
  uniRequestInterceptorInstalled = true

  return () => {
    if (installedUniInterceptor) {
      uniRuntime.removeInterceptor?.('request', installedUniInterceptor)
    }
    installedUniInterceptor = null
    uniRequestInterceptorInstalled = false
  }
}

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
  email?: string
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
export type CanvasSaveVersionType = 'IMAGE' | 'VIDEO' | 'TEXT' | 'CUSTOM'

export interface CanvasSaveRequest {
  /** 客户端当前画布版本，用于乐观锁校验。 */
  revision: number
  /** 保存类型，默认 MANUAL。 */
  saveType?: 'MANUAL' | 'AUTO' | string
  /** 画布快照 JSON 数据。 */
  canvasData: CanvasData
  /** 画布最后一次提交的描述。 */
  description?: string
  /** 版本类型：IMAGE=图片，VIDEO=视频，TEXT=文字，CUSTOM=自定义 */
  type?: CanvasSaveVersionType
}

/** GET /projects/{projectId}/canvas 响应 data。 */
export interface ProjectCanvasResponse {
  projectId: string
  revision: number
  canvasData: CanvasData
  canvas: CanvasData
  updatedAt: string
  description?: string
}

/** PUT /projects/{projectId}/canvas 响应 data。 */
export interface CanvasSaveResponse extends ProjectCanvasResponse {
  savedAt: string
}

/** GET /projects/{projectId}/versions 单条版本记录。 */
export interface ProjectVersionRecord {
  id: string | number
  versionNo?: number
  description?: string
  type?: CanvasSaveVersionType | string
  createdAt?: string
}

/** GET /projects/{projectId}/versions/{versionId} 版本详情。 */
export interface ProjectVersionDetailResponse {
  id: string | number
  projectId?: string
  versionNo?: number
  revision?: number
  canvasData?: CanvasData
  canvas?: CanvasData
  description?: string
  type?: CanvasSaveVersionType | string
  createdAt?: string
}

export interface ShareCreateRequest {
  expireDays?: number
}

export interface UploadTicketRequest {
  projectId?: Id
  fileName: string
  contentType: string
  fileSize: number
  /** 直传模式下可不传，由前端 PUT 到返回的 previewUrl */
  fileBase64?: string
  type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | string
}

/** `POST /assets/upload-tickets` 上传并创建素材记录（或申请直传相关字段）。 */
export interface AssetUploadResponse {
  id: Id
  type: 'IMAGE' | 'VIDEO' | string
  source: string
  fileName: string
  previewUrl: string
  url: string
  objectKey: string
  authorization?: string
  fileSize: number
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  status: string
  favorited?: boolean
  tags?: string[]
  createdAt: string
}

/** `POST /assets/upload-credentials` 申请前缀直传凭证。 */
export interface AssetUploadCredentialsResponse {
  uploadUrl?: string
  previewUrl?: string
  url?: string
  objectKey: string
  method?: string
  authorization?: string
  Authorization?: string
  headers?: Record<string, string>
  prefix?: string
  expiredAt?: number
}

/** `POST /assets` 文件上传完成后确认上传并创建素材记录（旧流程）。 */
export interface AssetCompleteUploadRequest {
  uploadTicket: string
  projectId?: Id
  fileSize: number
}

/** `POST /assets/upload-complete` 前端直传完成确认。 */
export interface AssetDirectUploadCompleteRequest {
  contentType: string
  fileName: string
  fileSize: number
  objectKey: string
  projectId?: Id
  type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | string
}

export interface AssetView {
  id: Id
  type: 'IMAGE' | 'VIDEO' | string
  source: string
  fileName: string
  previewUrl: string
  url?: string
  objectKey?: string
  fileSize: number
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  status: string
  favorited?: boolean
  tags?: string[]
  createdAt: string
}

export interface PointEstimateRequest {
  capabilityCode: string
  parameters?: { count?: number } & JsonObject
}

export interface PromptTranslateRequest {
  text: string
  targetLanguage: string
}

export interface PromptTranslationData {
  sourceText?: string
  targetLanguage?: string
  translatedText: string
}

export interface GenerationTaskCreateRequest {
  projectId?: Id
  nodeId?: Id
  taskType?: string
  capabilityCode: string
  prompt?: string
  parameters?: JsonObject
  referenceAssetIds?: Id[]
  assetIds?: Id[]
  workflowId?: Id | null
}

export interface ChatSessionCreateRequest {
  projectId?: Id
  title?: string
}

export interface ChatSessionData {
  id: string
  projectId: string | null
  title: string
  createdAt: string
  updatedAt: string
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

export interface CanvasElementGroupSaveRequest {
  projectName: string
  projectDescription: string
  projectStructure: {
    cells: JsonObject[]
  }
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
  /** 日期筛选，格式 yyyy-MM-dd */
  date?: string
  pageSize?: number
  page?: number
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

export interface GenerateImageRequest {
  model: string
  prompt: string
  n: number
  size: string
  stream: boolean
}

export interface GenerateVideoRequest {
  model: string
  prompt: string
  imageUrl: string
  duration: number
  aspectRatio: string
  resolution: string
  stream: boolean
  providerBody: JsonObject
}

export interface CallToolRequest {
  imageUrl: string
  parameters: JsonObject
}

const pathId = (value: string) => encodeURIComponent(value)

const api = {
  // Auth
  /** 发送登录短信验证码。 */
  querySmsCode(data: QuerySmsCodeRequest) {
    return http.post('/auth/sms-code', data)
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
    return http.put<T>('/users/me', data)
  },
  /** 获取当前用户的积分账户。 */
  getPointsAccount<T = unknown>() {
    return http.get<T>('/points/account')
  },
  /** 分页查询积分流水，可按收支方向筛选。 */
  getPointsLedger<T = unknown>(params?: PageQuery & { direction?: string }) {
    return http.get<PageResult<T>>('/points/ledgers', { params })
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
    return http.put<T>(`/projects/${pathId(projectId)}`, data)
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
  /** 申请直传凭证，返回 previewUrl（PUT 目标）与 objectKey。 */
  createAssetUploadTicket(data: UploadTicketRequest, config?: RequestConfig) {
    return http.post<AssetUploadResponse>('/assets/upload-tickets', data, config)
  },
  createAssetUploadCredentials(data: UploadTicketRequest, config?: RequestConfig) {
    return http.post<AssetUploadCredentialsResponse>('/assets/upload-credentials', data, config)
  },
  /** 前端直传完成确认：核验对象 + 内容审核 + 创建素材记录。 */
  completeAssetCompleteUpload(data: AssetDirectUploadCompleteRequest, config?: RequestConfig) {
    return http.post<AssetUploadResponse>('/assets/upload-complete', data, config)
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
  translatePrompt<T = PromptTranslationData>(data: PromptTranslateRequest) {
    return http.post<T>('/ai/prompt-translations', data)
  },
  /** 分页查询生成任务，可按项目和任务状态筛选。 */
  getGenerationTasks<T = unknown>(params?: GenerationTaskListQuery) {
    return http.get<PageResult<T>>('/generation-tasks', { params })
  },
  /** 创建 AI 生成任务。 */
  createGenerationTask<T = unknown>(data: GenerationTaskCreateRequest, idempotencyKey?: string) {
    return http.post<T>('/generation-tasks', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
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
  createChatSession<T = ChatSessionData>(data: ChatSessionCreateRequest = {}) {
    return http.post<T>('/chat-sessions', data)
  },
  /** 删除指定对话会话。 */
  deleteChatSession(sessionId: Id) {
    return http.delete(`/chat-sessions/${pathId(sessionId)}`)
  },
  queryChatSession<T = unknown>(sessionId: Id) {
    return http.get<T>(`/chat-sessions/${pathId(sessionId)}`)
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
    return http.post('/trial-applications/sms-code', data)
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
  createOrder<T = unknown>(data: OrderCreateRequest, idempotencyKey?: string) {
    return http.post<T>('/orders', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
  },
  /** 获取指定订单的详情。 */
  getOrder<T = unknown>(orderNo: string) {
    return http.get<T>(`/orders/${pathId(orderNo)}`)
  },
  /** 为指定订单创建支付单。 */
  createPayment<T = unknown>(orderNo: string, data: PaymentCreateRequest) {
    return http.post<T>(`/orders/${pathId(orderNo)}/payments`, data)
  },
  /** 取消当前订阅的自动续费。 */
  cancelSubscriptionAutoRenew<T = unknown>() {
    return http.post<T>('/subscriptions/cancel-auto-renew')
  },
  /** 获取首页聚合数据，可按灵感分类筛选。 */
  getHome<T = unknown>(categoryCode?: string) {
    return http.get<T>('/home', { params: categoryCode ? { categoryId: categoryCode } : undefined })
  },
  /** 生成图片。 */
  generateImage<T = unknown>(data: GenerateImageRequest) {
    return http.post<T>('/provider/images/generations', data)
  },
  /** 生成图片。 */
  generateVideo<T = unknown>(data: GenerateVideoRequest) {
    return http.post<T>('/provider/videos/generations', data)
  },
  /** 查询工具白名单。 */
  getTools<T = unknown>() {
    return http.get<T>('/provider/tools')
  },
  /** 调用工具。 */
  callTool<T = unknown>(toolCode: string, data: CallToolRequest) {
    return http.post<T>(`/provider/tools/${toolCode}`, data)
  },
  getChatModels<T = unknown>() {
    return http.get<T>('/provider/chat/models')
  },
  /** 保存画布元素组 */
  saveElementGroups<T = unknown>(projectId: Id, data: CanvasElementGroupSaveRequest) {
    return http.post<T>(`/projects/${pathId(projectId)}/element-groups`, data)
  },
  /** 画布元素组列表 */
  queryElementGroups<T = unknown>(_projectId: Id, params?: PageQuery) {
    return http.get<T>(`/element-groups`, { params })
  },
  queryAiCapabilities<T = unknown>(params:any) {
    return http.get<T>('/canvas/capabilities', { params })
  },
  queryChatTools<T = unknown>(params:any) {
    return http.get<T>('/canvas/chat-tools', { params })
  },
  queryPointRechargePackages<T = unknown>() {
    return http.get<T>('/points/recharge/packages')
  },
  /** 生成图片。 */
  createPointRechargeOrder<T = unknown>(data: any, idempotencyKey?: string) {
    return http.post<T>('/points/recharge/orders', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    })
  },
  /** 生成图片。 */
  ocrRecognize<T = unknown>(data: { assetId: string | number }) {
    return http.post<T>('/ocr/recognize', data)
  },
  queryToolbarPreferences<T = unknown>(params:any) {
    return http.get<T>('/canvas/toolbar-preferences', { params })
  },
  updateToolbarPreferences<T = unknown>(data: {
    hiddenCodes?: string[]
    nodeType: string
    orderedCodes?: string[]
  }) {
    return http.put<T>('/canvas/toolbar-preferences', data)
  },
  /** 删除画布元素组。 */
  deleteProjectElementGroup(_projectId: Id, groupId: Id) {
    return http.delete(`/element-groups/${pathId(groupId)}`)
  },
  queryMaterialCategories<T = unknown>() {
    return http.get<T>('/materials/categories', {  })
  },
  queryMaterials<T = unknown>(params:any) {
    return http.get<T>('/materials', { params })
  },
  queryMaterialFavorites<T = unknown>(params?: {
    type?: 'IMAGE' | 'VIDEO' | string
    page?: number
    pageSize?: number
  }) {
    return http.get<T>('/materials/favorites', { params })
  },
  favoriteMaterial<T = unknown>(materialId: Id) {
    return http.put<T>(`/materials/${pathId(materialId)}/favorite`)
  },
  unfavoriteMaterial(materialId: Id) {
    return http.delete(`/materials/${pathId(materialId)}/favorite`)
  },
  favoriteInspiration<T = unknown>(materialId: Id) {
    return http.put<T>(`/inspirations/${pathId(materialId)}/favorite`)
  },
  unfavoriteInspiration(materialId: Id) {
    return http.delete(`/inspirations/${pathId(materialId)}/favorite`)
  },
  queryAiSkills<T = unknown>() {
    return http.get<T>('/agent-skills')
  },
  /** 保存画布元素组 */
  notifyFpapi<T = unknown>(data: any) {
    return http.post<T>(`/invoices/fpapi/notify`, data)
  },
  /** 保存画布元素组 */
  applyInvoice<T = unknown>(data: any) {
    return http.post<T>(`/invoices/apply`, data)
  },
  /** 查询我的数字人列表 */
  getDigitalHumans<T = unknown>(params?: PageQuery) {
    return http.get<PageResult<T>>('/digital-humans', { params })
  },
  /** 新增数字人 */
  createDigitalHuman<T = unknown>(data: { assetId: string | number }) {
    return http.post<T>(`/digital-humans`, data)
  },
  queryInvoiceTitles<T = unknown>(params?: { keyword?: string }) {
    return http.get<T>('invoices/title/search', { params })
  },
}
export default api
