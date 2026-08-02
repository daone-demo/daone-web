let suppressLeaveConfirmCount = 0

export function suppressLeaveConfirm() {
  suppressLeaveConfirmCount += 1
}

export function resumeLeaveConfirm() {
  suppressLeaveConfirmCount = Math.max(0, suppressLeaveConfirmCount - 1)
}

export function isLeaveConfirmSuppressed() {
  return suppressLeaveConfirmCount > 0
}

export async function runWithoutLeaveConfirm<T>(task: () => Promise<T> | T): Promise<T> {
  suppressLeaveConfirm()
  try {
    return await task()
  } finally {
    window.setTimeout(() => {
      resumeLeaveConfirm()
    }, 300)
  }
}
