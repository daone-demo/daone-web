/**
 * 通知变更操作的 action session：防重复提交，并按身份校验迟到响应。
 */
export type NotificationMutationGate = {
  beginMarkAll: () => NotificationMutationTicket | null
  beginMarkOne: (notificationId: string | number) => NotificationMutationTicket | null
  beginDelete: (notificationId: string | number) => NotificationMutationTicket | null
  invalidate: () => void
  isMarkAllBusy: () => boolean
  isItemBusy: (notificationId: string | number) => boolean
}

export type NotificationMutationTicket = {
  /** 响应返回后：身份未变且本操作仍是有效票据时才可写状态 */
  canCommit: () => boolean
  end: () => void
}

export function createNotificationMutationGate(
  getIdentity: () => string,
): NotificationMutationGate {
  let markAllSeq = 0
  let markAllBusy = false
  const itemBusy = new Set<string>()

  const itemKey = (id: string | number) => String(id)

  const beginItem = (notificationId: string | number) => {
    const key = itemKey(notificationId)
    if (!key || itemBusy.has(key)) return null
    itemBusy.add(key)
    const identity = getIdentity()
    return {
      canCommit: () => itemBusy.has(key) && identity === getIdentity(),
      end: () => {
        itemBusy.delete(key)
      },
    }
  }

  return {
    beginMarkAll() {
      if (markAllBusy) return null
      markAllBusy = true
      const seq = ++markAllSeq
      const identity = getIdentity()
      return {
        canCommit: () => markAllBusy && seq === markAllSeq && identity === getIdentity(),
        end: () => {
          if (seq === markAllSeq) markAllBusy = false
        },
      }
    },
    beginMarkOne: beginItem,
    beginDelete: beginItem,
    invalidate() {
      markAllSeq += 1
      markAllBusy = false
      itemBusy.clear()
    },
    isMarkAllBusy: () => markAllBusy,
    isItemBusy: (notificationId) => itemBusy.has(itemKey(notificationId)),
  }
}
