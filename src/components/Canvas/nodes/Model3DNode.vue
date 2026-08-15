<template>
  <div
    class="model3d-node"
    :class="{
      'model3d-node--selected': data.isSelected,
      'model3d-node--light': isLightTheme,
      'model3d-node--generating': data.imageGenState === 'loading',
    }"
  >
    <button
      type="button"
      class="node-port-plus"
      :style="portPlusStyle"
      title="添加连线节点"
      @pointerdown.stop="onPlusPointerDown"
    >
      +
    </button>

    <div class="model3d-node__meta canvas-node__meta">
      <span class="model3d-node__title">
        <span class="model3d-node__title-icon">3D</span>
        <span class="model3d-node__title-text">{{ data.title || '3D 模型' }}</span>
      </span>
      <span v-if="data.imageGenState === 'loading'" class="model3d-node__hint">
        <!-- {{ genHintText }} -->
      </span>
      <span v-else class="model3d-node__hint">拖拽旋转 · 滚轮缩放</span>
      <button
        type="button"
        class="canvas-node__delete"
        title="删除节点"
        @mousedown.stop
        @click="removeSelf"
      >
        ×
      </button>
    </div>

    <div class="model3d-node__body">
      <div
        ref="viewerRef"
        class="model3d-node__viewer"
        @mousedown.stop
        @pointerdown.stop
        @wheel.stop.prevent
      />
      <div v-if="data.imageGenState === 'loading'" class="model3d-node__overlay model3d-node__overlay--generating">
        <span class="model3d-node__spinner" aria-hidden="true" />
        <span>{{ genHintText }}</span>
      </div>
      <div v-else-if="isGenerationFailed" class="model3d-node__overlay model3d-node__overlay--failed">
        <CanvasGenerationFailPanel
          :message="failMessage"
          :task-id="data.generationTaskId"
          :light="isLightTheme"
        />
      </div>
      <div v-else-if="loadState === 'loading'" class="model3d-node__overlay">
        <span class="model3d-node__spinner" aria-hidden="true" />
        <span>加载 3D 模型…</span>
      </div>
      <div v-else-if="loadState === 'error'" class="model3d-node__overlay model3d-node__overlay--error">
        <span>模型加载失败</span>
        <button type="button" class="model3d-node__retry" @mousedown.stop @click="reloadModel">
          重试
        </button>
      </div>
      <div v-else-if="!data.previewUrl" class="model3d-node__overlay">
        <span>暂无 GLB 地址</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Node } from '@antv/x6'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CanvasNodeData } from '../constants'
import { isCanvasGenerationFailed, resolveGenerationFailMessage } from '../constants'
import CanvasGenerationFailPanel from './CanvasGenerationFailPanel.vue'
import { useNodeDelete } from './useNodeDelete'
import { useNodeConnect } from './useNodeConnect'
import { useNodePortPlusStyle } from './useNodePortPlusStyle'
import { useCanvasBgTheme } from '../useCanvasBgTheme'
import { syncNodeViewData } from './syncNodeViewData'

const getNode = inject<() => Node>('getNode')!
const { removeSelf } = useNodeDelete()
const { onPlusPointerDown } = useNodeConnect()
const { portPlusStyle } = useNodePortPlusStyle()
const { isLightTheme } = useCanvasBgTheme()

const viewerRef = ref<HTMLDivElement | null>(null)
const loadState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

const data = reactive<CanvasNodeData>({
  kind: 'model3d',
  title: '3D 模型',
  mode: 'editor',
  content: '',
  uploadState: 'idle',
  uploadProgress: 0,
  mediaWidth: 320,
  mediaHeight: 360,
  previewUrl: '',
  fileName: '',
})

const genHintText = computed(() => {
  const progress = data.imageGenProgress ?? 0
  if (progress <= 0) return '准备中...'
  if (progress >= 100) return '即将完成...'
  return `生成中 ${progress}%`
})

const isGenerationFailed = computed(() => isCanvasGenerationFailed(data))
const failMessage = computed(() => resolveGenerationFailMessage(data))

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let currentModel: THREE.Object3D | null = null
let animFrame = 0
let resizeObserver: ResizeObserver | null = null
let disposed = false

function disposeModel() {
  if (!currentModel || !scene) return
  scene.remove(currentModel)
  currentModel.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (!material) return
    const list = Array.isArray(material) ? material : [material]
    list.forEach((m) => {
      Object.values(m).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose()
      })
      m.dispose()
    })
  })
  currentModel = null
}

function fitCameraToObject(object: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  object.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  const fov = (camera.fov * Math.PI) / 180
  const distance = maxDim / 2 / Math.tan(fov / 2)
  camera.position.set(distance * 0.75, distance * 0.45, distance * 1.15)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 20
  camera.updateProjectionMatrix()
  controls.target.set(0, 0, 0)
  controls.update()
}

function resizeRenderer() {
  const el = viewerRef.value
  if (!el || !renderer || !camera) return
  const width = el.clientWidth || 1
  const height = el.clientHeight || 1
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function animate() {
  if (disposed) return
  animFrame = requestAnimationFrame(animate)
  controls?.update()
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

function initViewer() {
  const el = viewerRef.value
  if (!el) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(isLightTheme.value ? 0xf3f4f6 : 0x1a1a1f)

  camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000)
  camera.position.set(2, 1.2, 2.5)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  el.appendChild(renderer.domElement)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = true
  controls.autoRotateSpeed = 1.2
  controls.enablePan = false

  const ambient = new THREE.AmbientLight(0xffffff, 0.65)
  const key = new THREE.DirectionalLight(0xffffff, 1.1)
  key.position.set(3, 5, 4)
  const fill = new THREE.DirectionalLight(0xc7d2fe, 0.45)
  fill.position.set(-3, 1, -2)
  scene.add(ambient, key, fill)

  resizeObserver = new ResizeObserver(() => resizeRenderer())
  resizeObserver.observe(el)
  resizeRenderer()
  animate()
}

function loadModel(url: string) {
  if (!scene || !url) {
    loadState.value = url ? 'error' : 'idle'
    return
  }

  loadState.value = 'loading'
  disposeModel()

  const loader = new GLTFLoader()
  loader.load(
    url,
    (gltf) => {
      if (disposed || !scene) return
      currentModel = gltf.scene
      scene.add(currentModel)
      fitCameraToObject(currentModel)
      loadState.value = 'ready'
    },
    undefined,
    () => {
      if (!disposed) loadState.value = 'error'
    },
  )
}

function reloadModel() {
  if (data.previewUrl) loadModel(data.previewUrl)
}

onMounted(() => {
  const node = getNode()
  syncNodeViewData(data, node.getData() as CanvasNodeData)
  node.on('change:data', ({ current }) => {
    syncNodeViewData(data, current as CanvasNodeData)
  })

  initViewer()
  if (data.previewUrl && data.imageGenState !== 'loading') {
    loadModel(data.previewUrl)
  }
})

watch(
  () => [data.previewUrl, data.imageGenState] as const,
  ([url, genState]) => {
    if (genState === 'loading') return
    if (url) loadModel(url)
  },
)

watch(isLightTheme, (light) => {
  if (!scene) return
  scene.background = new THREE.Color(light ? 0xf3f4f6 : 0x1a1a1f)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(animFrame)
  resizeObserver?.disconnect()
  resizeObserver = null
  disposeModel()
  controls?.dispose()
  controls = null
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
  scene = null
  camera = null
})
</script>

<style scoped lang="scss">
@use './node-delete.scss' as *;
@use './node-port-plus.scss' as *;
@use './node-generating-bg.scss' as *;
.model3d-node {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, sans-serif;
  color: #f3f4f6;
  pointer-events: auto;
  overflow: visible;
}

.model3d-node__meta {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  min-width: 0;
}

.model3d-node__title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  color: #9ca3af;
}

.model3d-node__title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #3d3d45;
  font-size: 9px;
  font-weight: 700;
  color: #d1d5db;
}

.model3d-node__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model3d-node__hint {
  flex-shrink: 0;
  color: #6b7280;
  font-size: 10px;
}

.model3d-node__body {
  position: relative;
  height: 100%;
  min-height: 0;
  border: 1px solid #3d3d45;
  border-radius: 12px;
  overflow: hidden;
  background: #1a1a1f;
}

.model3d-node__viewer {
  width: 100%;
  height: 100%;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.model3d-node__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(17, 17, 20, 0.55);
  color: #d1d5db;
  font-size: 12px;
  pointer-events: none;
}

.model3d-node__overlay--generating {
  @include node-generating-background();
  color: #8a8a8a;
}

.model3d-node__overlay--failed {
  background: #ffffff;
  color: #6b7280;
}

.model3d-node__overlay--error {
  pointer-events: auto;
  color: #fca5a5;
}

.model3d-node__retry {
  padding: 6px 12px;
  border: 1px solid #4b5563;
  border-radius: 8px;
  background: #252528;
  color: #e5e7eb;
  font-size: 12px;
  cursor: pointer;
}

.model3d-node__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #93a0ff;
  border-radius: 50%;
  animation: model3d-spin 0.8s linear infinite;
}

.model3d-node--light {
  color: #111827;

  .model3d-node__title {
    color: #6b7280;
  }

  .model3d-node__title-icon {
    background: #e5e7eb;
    color: #374151;
  }

  .model3d-node__hint {
    color: #9ca3af;
  }

  .model3d-node__body {
    border-color: #e5e7eb;
    background: #f3f4f6;
  }

  .model3d-node__overlay {
    background: rgba(243, 244, 246, 0.7);
    color: #374151;
  }
}

@keyframes model3d-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
