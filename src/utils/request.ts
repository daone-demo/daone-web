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

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null
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

function isPublicApi(url: string | undefined): boolean {
  if (!url) return false
  return /\/v1\/auth\/(sms-codes|sms-login|qr-)/.test(url)
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

function handleUnauthorized(tip?: string): void {
  if (authRedirecting) return
  authRedirecting = true
  removeToken()
  message.warning(tip || '登录已失效，请重新登录')
  onUnauthorized?.()
}

const HTTP_TIMEOUT = Number(import.meta.env.VITE_HTTP_TIMEOUT) || 60_000

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.DEV ? '/api/v1' : import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: HTTP_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
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

    if (response.status === 204) {
      return null
    }

    const res = response.data as ApiResponse

    if (isUnauthorized(res, response.status)) {
      handleUnauthorized(pickMessage(res))
      return Promise.reject(new Error('UNAUTHORIZED'))
    }

    if (res == null || typeof res !== 'object' || typeof res.code !== 'string') {
      if (!config.silent) message.error('接口返回格式异常')
      return Promise.reject(res)
    }

    if (!isApiSuccess(res)) {
      if (!config.silent) message.error(pickMessage(res) || '操作失败')
      return Promise.reject(res)
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
    if (error?.message === 'UNAUTHORIZED') {
      return Promise.reject(error)
    }

    const config = error.config as RequestConfig | undefined
    const silent = config?.silent
    const response = error.response

    if (response) {
      const data = response.data as ApiResponse | undefined
      if (isUnauthorized(data ?? null, response.status)) {
        handleUnauthorized(pickMessage(data))
        return Promise.reject(error)
      }
      if (!silent) {
        message.error(pickMessage(data) || `请求错误 (${response.status})`)
      }
      return Promise.reject(error)
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
