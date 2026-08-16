/**
 * P2-04 回归：画布资源/历史面板跨项目旧响应不得污染当前列表；
 * 历史分页失败不得推进页码。
 *
 * 运行：node --experimental-strip-types --test scripts/canvas-shell-panels-race.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createLatestRequestGuard,
  isPanelResponseCurrent,
} from '../src/components/Canvas/lib/latestRequestGuard.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type SkillState = {
  activeProjectId: string
  skillList: string[]
  loading: boolean
}

/** 复刻 onLoadSkill 的守卫语义 */
function createSkillLoader(state: SkillState) {
  const guard = createLatestRequestGuard()
  return async function onLoadSkill(fetchRecords: () => Promise<string[]>) {
    const projectId = state.activeProjectId
    if (!projectId) return
    const isCurrent = guard.begin()
    state.loading = true
    try {
      const records = await fetchRecords()
      if (
        !isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: state.activeProjectId,
        })
      ) {
        return
      }
      state.skillList = records.map((id) => `${projectId}:${id}`)
    } finally {
      if (
        isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: state.activeProjectId,
        })
      ) {
        state.loading = false
      }
    }
  }
}

type HistoryState = {
  activeProjectId: string
  historyList: string[]
  historyPage: number
  historyHasMore: boolean
  historyLoading: boolean
}

const HISTORY_PAGE_SIZE = 50

/** 复刻 onLoadHistory：失败不推进页码；成功才写入 page */
function createHistoryLoader(state: HistoryState) {
  const guard = createLatestRequestGuard()
  return async function onLoadHistory(
    reset: boolean,
    fetchPage: (projectId: string, page: number) => Promise<string[]>,
  ) {
    const projectId = state.activeProjectId
    if (!projectId) return
    // reset 可抢占进行中的请求；加载更多仍需串行
    if (!reset) {
      if (state.historyLoading || !state.historyHasMore) return
    }

    const pageToLoad = reset ? 1 : state.historyPage + 1
    if (reset) state.historyHasMore = true

    const isCurrent = guard.begin()
    state.historyLoading = true
    try {
      const records = await fetchPage(projectId, pageToLoad)
      if (
        !isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: state.activeProjectId,
        })
      ) {
        return
      }
      if (reset) {
        state.historyList = records.map((id) => `${projectId}:${id}`)
        state.historyPage = 1
      } else {
        state.historyList.push(...records.map((id) => `${projectId}:${id}`))
        state.historyPage = pageToLoad
      }
      state.historyHasMore = records.length >= HISTORY_PAGE_SIZE
    } catch {
      // 页码保持不变，便于重试同一页
    } finally {
      if (
        isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: state.activeProjectId,
        })
      ) {
        state.historyLoading = false
      }
    }
  }
}

test('资源面板 A→B：A 的慢响应不覆盖 B 的列表', async () => {
  const state: SkillState = {
    activeProjectId: 'A',
    skillList: [],
    loading: false,
  }
  const onLoadSkill = createSkillLoader(state)

  const slowA = deferred<string[]>()
  const pendingA = onLoadSkill(() => slowA.promise)

  state.activeProjectId = 'B'
  await onLoadSkill(() => Promise.resolve(['b1', 'b2']))
  assert.deepEqual(state.skillList, ['B:b1', 'B:b2'])
  assert.equal(state.loading, false)

  slowA.resolve(['a1'])
  await pendingA
  assert.deepEqual(state.skillList, ['B:b1', 'B:b2'])
  assert.equal(state.loading, false)
})

test('历史面板 A→B：A 的慢响应不覆盖 B 的列表', async () => {
  const state: HistoryState = {
    activeProjectId: 'A',
    historyList: [],
    historyPage: 1,
    historyHasMore: true,
    historyLoading: false,
  }
  const onLoadHistory = createHistoryLoader(state)

  const slowA = deferred<string[]>()
  const pendingA = onLoadHistory(true, () => slowA.promise)

  state.activeProjectId = 'B'
  await onLoadHistory(true, () => Promise.resolve(['b1']))
  assert.deepEqual(state.historyList, ['B:b1'])
  assert.equal(state.historyPage, 1)

  slowA.resolve(['a1', 'a2'])
  await pendingA
  assert.deepEqual(state.historyList, ['B:b1'])
  assert.equal(state.historyPage, 1)
})

test('历史加载更多失败时页码回滚（不推进），重试仍请求同一页', async () => {
  const state: HistoryState = {
    activeProjectId: 'P',
    historyList: ['P:v1'],
    historyPage: 1,
    historyHasMore: true,
    historyLoading: false,
  }
  const onLoadHistory = createHistoryLoader(state)
  const requestedPages: number[] = []

  await onLoadHistory(false, async (_projectId, page) => {
    requestedPages.push(page)
    throw new Error('network')
  })
  assert.equal(state.historyPage, 1)
  assert.deepEqual(requestedPages, [2])
  assert.equal(state.historyLoading, false)

  await onLoadHistory(false, async (_projectId, page) => {
    requestedPages.push(page)
    return ['v2']
  })
  assert.deepEqual(requestedPages, [2, 2])
  assert.equal(state.historyPage, 2)
  assert.deepEqual(state.historyList, ['P:v1', 'P:v2'])
})

test('isPanelResponseCurrent 在项目切换后为 false', () => {
  const guard = createLatestRequestGuard()
  const isCurrent = guard.begin()
  assert.equal(
    isPanelResponseCurrent({
      isCurrent,
      requestedProjectId: 'A',
      activeProjectId: 'A',
    }),
    true,
  )
  assert.equal(
    isPanelResponseCurrent({
      isCurrent,
      requestedProjectId: 'A',
      activeProjectId: 'B',
    }),
    false,
  )
  guard.begin()
  assert.equal(
    isPanelResponseCurrent({
      isCurrent,
      requestedProjectId: 'A',
      activeProjectId: 'A',
    }),
    false,
  )
})
