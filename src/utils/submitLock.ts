import { ref } from 'vue'

/** 提交锁，防止异步请求进行中重复提交 */
export function useSubmitLock() {
  const submitting = ref(false)

  const withSubmitLock = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (submitting.value) return
    submitting.value = true
    try {
      return await fn()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, withSubmitLock }
}

/** 复用已有 loading ref 的提交锁包装 */
export async function runWithSubmitLock<T>(
  lock: { value: boolean },
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (lock.value) return
  lock.value = true
  try {
    return await fn()
  } finally {
    lock.value = false
  }
}
