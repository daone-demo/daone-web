import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  bindOnSessionClear,
  getToken,
  removeToken,
  setToken as persistToken,
  unbindOnSessionClear,
} from '@/utils/request'

export const USER_INFO_KEY = 'daone_user_info'
export const POINT_ACCOUNT_KEY = 'daone_point_account'

/** 当前登录用户信息，额外的后端字段也会被保留。 */
export interface UserInfo {
  id?: string
  userId?: string
  phone?: string
  nickname?: string
  avatarUrl?: string | null
  status?: string
  createdAt?: string
  [key: string]: unknown
}

export interface PointAccount {
  available: number
  frozen: number
  grantedTotal: number
}

function readStoredUserInfo(): UserInfo | null {
  const value = localStorage.getItem(USER_INFO_KEY)
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object'
      ? parsed as UserInfo
      : null
  } catch {
    localStorage.removeItem(USER_INFO_KEY)
    return null
  }
}

function readStoredPointAccount(): PointAccount | null {
  const value = localStorage.getItem(POINT_ACCOUNT_KEY)
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object'
      ? parsed as PointAccount
      : null
  } catch {
    localStorage.removeItem(POINT_ACCOUNT_KEY)
    return null
  }
}

export const useUserInfo = defineStore('userInfo', () => {
  /** 用户 token，与 Axios 请求层共用同一个 localStorage key。 */
  const token = ref(getToken() ?? '')
  const pointAccount = ref<PointAccount | null>(readStoredPointAccount())

  /** 当前用户资料。 */
  const userInfo = ref<UserInfo | null>(readStoredUserInfo())

  /** 当前是否存在有效的登录凭证。 */
  const isLoggedIn = computed(() => Boolean(token.value))

  /** 当前是否已加载用户资料。 */
  const hasUserInfo = computed(() => userInfo.value !== null)

  /** 保存用户 token，并同步至 Axios 请求层使用的本地存储。 */
  function setUserToken(value: string) {
    const nextToken = value.trim()
    token.value = nextToken

    if (nextToken) {
      persistToken(nextToken)
    } else {
      removeToken()
    }
  }

  function setPointAccount(value: PointAccount | null) {
    pointAccount.value = value
    if (value) {
      localStorage.setItem(POINT_ACCOUNT_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(POINT_ACCOUNT_KEY)
    }
  }

  /** 覆盖当前用户资料并持久化。 */
  function setUserInfo(value: UserInfo | null) {
    userInfo.value = value

    if (value) {
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(USER_INFO_KEY)
    }
  }

  /** 合并更新当前用户资料。 */
  function updateUserInfo(value: Partial<UserInfo>) {
    setUserInfo({
      ...(userInfo.value ?? {}),
      ...value,
    })
  }

  /** 登录成功后一次性保存 token 和用户资料。 */
  function setSession(value: string, info?: UserInfo | null) {
    setUserToken(value)
    if (info !== undefined) {
      setUserInfo(info)
    }
  }

  /** 清除用户资料，但保留 token。 */
  function clearUserInfo() {
    setUserInfo(null)
  }

  /** 退出登录并清除全部用户会话数据。 */
  function clearSession() {
    token.value = ''
    userInfo.value = null
    removeToken()
    localStorage.removeItem(USER_INFO_KEY)
  }

  return {
    pointAccount,
    token,
    userInfo,
    isLoggedIn,
    hasUserInfo,
    setUserToken,
    setUserInfo,
    updateUserInfo,
    setSession,
    clearUserInfo,
    clearSession,
    setPointAccount
  }
})

/** 401 等未授权场景：清空 localStorage 并重置 Pinia 用户状态 */
export function setupUserInfoAuthSync() {
  bindOnSessionClear(() => {
    useUserInfo().clearSession()
  })
}

export function teardownUserInfoAuthSync() {
  unbindOnSessionClear()
}
