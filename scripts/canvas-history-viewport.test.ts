/**
 * undo/redo 不应恢复历史 viewport，且避免 fromJSON 中间态闪烁。
 * 运行：node --experimental-strip-types --test scripts/canvas-history-viewport.test.ts
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

/** 与 canvasHistory.applyCanvasSnapshot 的 viewport 分支保持一致 */
function applyViewportFromSnapshot(
  snapshot: {
    viewport: {
      zoom: number
      translateX: number
      translateY: number
      scrollLeft: number
      scrollTop: number
    }
  },
  handlers: {
    zoomTo: (zoom: number) => void
    translate: (tx: number, ty: number) => void
    setScroll: (left: number, top: number) => void
  },
  options?: { preserveViewport?: boolean },
) {
  if (options?.preserveViewport) return
  handlers.zoomTo(snapshot.viewport.zoom)
  handlers.translate(snapshot.viewport.translateX, snapshot.viewport.translateY)
  handlers.setScroll(snapshot.viewport.scrollLeft, snapshot.viewport.scrollTop)
}

/** undo/redo 路径：跳过 ensureInfiniteCanvasArea，避免 resize 引发闪烁 */
function shouldResizeInfiniteArea(options?: { preserveViewport?: boolean }) {
  return options?.preserveViewport !== true
}

test('undo/redo preserveViewport：不应用历史 zoom/translate/scroll', () => {
  const calls = {
    zoom: [] as number[],
    translate: [] as Array<[number, number]>,
    scroll: [] as Array<[number, number]>,
  }
  applyViewportFromSnapshot(
    {
      viewport: {
        zoom: 0.5,
        translateX: 120,
        translateY: 80,
        scrollLeft: 300,
        scrollTop: 200,
      },
    },
    {
      zoomTo: (z) => calls.zoom.push(z),
      translate: (tx, ty) => calls.translate.push([tx, ty]),
      setScroll: (l, t) => calls.scroll.push([l, t]),
    },
    { preserveViewport: true },
  )
  assert.equal(calls.zoom.length, 0)
  assert.equal(calls.translate.length, 0)
  assert.equal(calls.scroll.length, 0)
})

test('加载项目快照：默认仍恢复 viewport', () => {
  const calls = {
    zoom: [] as number[],
    translate: [] as Array<[number, number]>,
    scroll: [] as Array<[number, number]>,
  }
  applyViewportFromSnapshot(
    {
      viewport: {
        zoom: 1.2,
        translateX: 10,
        translateY: 20,
        scrollLeft: 30,
        scrollTop: 40,
      },
    },
    {
      zoomTo: (z) => calls.zoom.push(z),
      translate: (tx, ty) => calls.translate.push([tx, ty]),
      setScroll: (l, t) => calls.scroll.push([l, t]),
    },
  )
  assert.deepEqual(calls.zoom, [1.2])
  assert.deepEqual(calls.translate, [[10, 20]])
  assert.deepEqual(calls.scroll, [[30, 40]])
})

test('undo/redo 路径不触发无限画布 resize', () => {
  assert.equal(shouldResizeInfiniteArea({ preserveViewport: true }), false)
  assert.equal(shouldResizeInfiniteArea(), true)
  assert.equal(shouldResizeInfiniteArea({ preserveViewport: false }), true)
})
