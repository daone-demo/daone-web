import { computed, inject, onMounted, ref, type CSSProperties } from 'vue'
import type { Node } from '@antv/x6'

const MIN_PORT_PLUS_SIZE = 8
const MAX_PORT_PLUS_SIZE = 18

/** 根据节点显示区域最小边计算连线加号尺寸 */
export function resolveNodePortPlusMetrics(width: number, height: number) {
  const minDim = Math.max(1, Math.min(width, height))
  const size = Math.min(
    MAX_PORT_PLUS_SIZE,
    Math.max(MIN_PORT_PLUS_SIZE, Math.round(minDim * 0.08 + 6)),
  )
  const offset = Math.max(size + 1, Math.round(size * 1.12))
  const arm = Math.max(4, Math.round(size * 0.44))
  const stroke = size <= 11 ? 1 : 1.5
  return { size, offset, arm, stroke }
}

export function useNodePortPlusStyle() {
  const getNode = inject<() => Node>('getNode')!
  const sizeRevision = ref(0)

  onMounted(() => {
    const node = getNode()
    node.on('change:size', () => {
      sizeRevision.value += 1
    })
  })

  const portPlusStyle = computed<CSSProperties>(() => {
    void sizeRevision.value
    const { width, height } = getNode().getSize()
    const { size, offset, arm, stroke } = resolveNodePortPlusMetrics(width, height)
    return {
      width: `${size}px`,
      height: `${size}px`,
      right: `-${offset}px`,
      '--node-port-plus-arm': `${arm}px`,
      '--node-port-plus-stroke': `${stroke}px`,
    }
  })

  return { portPlusStyle }
}
