import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { message } from 'ant-design-vue'

const TOKEN_KEY = 'daone_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
  traceId?: string
}

export interface RequestConfig extends AxiosRequestConfig {
  /** 为 true 时不弹出错误提示 */
  silent?: boolean
  /** 为 true 时返回完整 ApiResponse，不解包 data */
  raw?: boolean
}

export class RequestError extends Error {
  readonly status: number
  readonly code: string
  readonly data?: unknown
  readonly traceId?: string
  readonly isUnauthorized: boolean
  readonly response: { status: number; data?: unknown }

  constructor(options: {
    message: string
    status: number
    code?: string
    data?: unknown
    traceId?: string
    isUnauthorized?: boolean
  }) {
    super(options.message)
    this.name = 'RequestError'
    this.status = options.status
    this.code = options.code ?? (options.isUnauthorized ? 'UNAUTHORIZED' : 'REQUEST_FAILED')
    this.data = options.data
    this.traceId = options.traceId
    this.isUnauthorized = options.isUnauthorized ?? false
    this.response = { status: options.status, data: options.data }
  }
}

export function isRequestError(error: unknown): error is RequestError {
  if (error instanceof RequestError) return true
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as Partial<RequestError>
  return candidate.name === 'RequestError' && typeof candidate.status === 'number'
}

type UnauthorizedHandler = () => void
type SessionClearHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null
let onSessionClear: SessionClearHandler | null = null
let authRedirecting = false

export function resetAuthRedirecting(): void {
  authRedirecting = false
}

export function bindOnUnauthorized(handler: UnauthorizedHandler): void {
  onUnauthorized = handler
}

export function unbindOnUnauthorized(): void {
  onUnauthorized = null
}

export function bindOnSessionClear(handler: SessionClearHandler): void {
  onSessionClear = handler
}

export function unbindOnSessionClear(): void {
  onSessionClear = null
}

function isPublicApi(url: string | undefined): boolean {
  if (!url) return false
  return /^\/auth\/(sms-codes|sms-login|wechat\/qr-sessions)/.test(url)
}

function pickMessage(payload: unknown): string {
  if (payload == null || typeof payload !== 'object') return ''
  const obj = payload as Record<string, unknown>
  return String(obj.message ?? obj.msg ?? obj.errmsg ?? '')
}

function isApiSuccess(res: ApiResponse): boolean {
  return res.code === 'OK'
}

function isUnauthorized(res: ApiResponse | null, status?: number): boolean {
  if (status === 401) return true
  return res?.code === 'UNAUTHORIZED'
}

function toApiResponse(payload: unknown): ApiResponse | null {
  if (payload == null || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  if (typeof obj.code !== 'string') return null
  return payload as ApiResponse
}

function createRequestError(
  payload: unknown,
  status: number,
  options?: { unauthorized?: boolean; fallbackMessage?: string },
): RequestError {
  const res = toApiResponse(payload)
  const unauthorized = options?.unauthorized ?? isUnauthorized(res, status)
  return new RequestError({
    message:
      pickMessage(payload) ||
      options?.fallbackMessage ||
      (unauthorized ? '登录已失效，请重新登录' : '操作失败'),
    status: unauthorized ? (status || 401) : status,
    code: res?.code ?? (unauthorized ? 'UNAUTHORIZED' : 'REQUEST_FAILED'),
    data: res?.data ?? payload,
    traceId: res?.traceId,
    isUnauthorized: unauthorized,
  })
}

function handleUnauthorized(): void {
  if (authRedirecting) return
  authRedirecting = true
  if (onSessionClear) {
    onSessionClear()
  } else {
    removeToken()
  }
  onUnauthorized?.()
}

function rejectUnauthorized(
  payload: unknown,
  status: number,
  url?: string,
): Promise<never> {
  const error = createRequestError(payload, status, { unauthorized: true })
  if (!isPublicApi(url)) {
    handleUnauthorized()
  }
  return Promise.reject(error)
}

const HTTP_TIMEOUT = Number(import.meta.env.VITE_HTTP_TIMEOUT) || 60_000

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.DEV ? '/api/v1' : import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: HTTP_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token && !isPublicApi(config.url)) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    message.error('请求发送失败')
    return Promise.reject(error)
  },
)

instance.interceptors.response.use(
  ((response) => {
    const config = response.config as InternalAxiosRequestConfig & RequestConfig
    const httpStatus = response.status
    const requestUrl = config.url

    if (httpStatus === 204) {
      return null
    }

    const payload = response.data
    const res = toApiResponse(payload)

    if (httpStatus === 401 || isUnauthorized(res, httpStatus)) {
      return rejectUnauthorized(payload, httpStatus || 401, requestUrl)
    }

    if (httpStatus < 200 || httpStatus >= 300) {
      const requestError = createRequestError(payload, httpStatus, {
        fallbackMessage: `请求错误 (${httpStatus})`,
      })
      if (!config.silent) message.error(requestError.message)
      return Promise.reject(requestError)
    }

    if (res == null || typeof res.code !== 'string') {
      if (!config.silent) message.error('接口返回格式异常')
      return Promise.reject(createRequestError(payload, httpStatus, { fallbackMessage: '接口返回格式异常' }))
    }

    if (!isApiSuccess(res)) {
      if (!config.silent) message.error(pickMessage(res) || '操作失败')
      return Promise.reject(createRequestError(res, httpStatus))
    }

    if (config.raw) {
      return res
    }

    return res.data
  }) as (value: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>,
  (error) => {
    if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
      return Promise.reject(error)
    }
    if (isRequestError(error)) {
      return Promise.reject(error)
    }

    const config = error.config as RequestConfig | undefined
    const silent = config?.silent
    const response = error.response

    if (response) {
      const data = response.data
      const httpStatus = response.status || 500
      if (httpStatus === 401 || isUnauthorized(toApiResponse(data), httpStatus)) {
        return rejectUnauthorized(data, httpStatus, config?.url)
      }
      const requestError = createRequestError(data, httpStatus, {
        fallbackMessage: `请求错误 (${httpStatus})`,
      })
      if (!silent) message.error(requestError.message)
      return Promise.reject(requestError)
    }

    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      if (!silent) message.error('请求超时，请稍后重试')
    } else if (error.request) {
      if (!silent) message.error('网络异常，服务器无响应')
    } else if (!silent) {
      message.error(error.message || '请求失败')
    }

    return Promise.reject(error)
  },
)

export default instance

export function request<T = unknown>(config: RequestConfig): Promise<T> {
  return instance.request(config) as Promise<T>
}

export const http = {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return request<T>({ ...config, method: 'GET', url })
  },
  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>({ ...config, method: 'POST', url, data })
  },
  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>({ ...config, method: 'PUT', url, data })
  },
  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return request<T>({ ...config, method: 'PATCH', url, data })
  },
  delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return request<T>({ ...config, method: 'DELETE', url })
  },
}
