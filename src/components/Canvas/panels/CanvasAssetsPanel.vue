<template>
  <aside
    class="canvas__assets"
    :class="{ 'canvas__assets--light': isLight }"
    @mousedown.stop
  >
    <div class="canvas__assets-head">
      <a-flex justify="space-between" align="center" flex="1">
        <nav class="canvas__assets-tabs" aria-label="素材分类">
          <button
            v-for="item in PROJECT_TABS"
            :key="item.key"
            type="button"
            class="canvas__assets-tab"
            :class="{ 'canvas__assets-tab--active': tab === item.key }"
            @click="onChangeTab(item.key)"
          >
            {{ item.label }}
          </button>
        </nav>
        <a-flex gap="10" align="center">
          <a-button
            v-if="!batchSelectMode"
            size="small"
            @click="enterBatchSelectMode"
          >
            批量选择
          </a-button>
          <a-button
            v-else
            type="text"
            size="small"
            class="canvas__assets-cancel-select"
            @click="exitBatchSelectMode"
          >
            取消选择
          </a-button>
          <template v-if="!batchSelectMode && tab == 'FILES'">
            <a-date-picker
              :value="date"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              allow-clear
              placeholder="选择日期"
              @update:value="onDateChange"
            />
            <a-select
              :value="type"
              @update:value="onTypeChange"
              style="width: 100px"
            >
              <a-select-option
                v-for="item in ASSETS_TYPE_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </a-select-option>
            </a-select>
          </template>
          <template v-if="!batchSelectMode && tab == 'CENTER'">
            <a-select
              :value="type"
              @update:value="onTypeChange"
              style="width: 100px"
            >
              <a-select-option
                v-for="item in ASSETS_TYPE_OPTIONS"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </a-select-option>
            </a-select>
          </template>
        </a-flex>
      </a-flex>
      <button type="button" class="canvas__assets-close" @click="onClose">×</button>
    </div>

    <div
      v-if="batchSelectMode"
      class="canvas__assets-batch-bar"
    >
      <span class="canvas__assets-batch-count">已选 {{ selectedAssetIds.length }} 个</span>
      <a-button
        type="primary"
        size="small"
        :disabled="!selectedAssetIds.length"
        @click="onBatchInsert"
      >
        批量插入画布({{ selectedAssetIds.length }})
      </a-button>
    </div>

    <div class="canvas__assets-body">
      <MaterialAssetsContent
        ref="materialAssetsRef"
        :key="tab"
        :scope="tab"
        :asset-type="type"
        :asset-date="date"
        :project-id="projectId"
        :column-count="CANVAS_MATERIAL_COLUMN_COUNT"
        embedded
        :is-light="isLight"
        :enable-drag="!batchSelectMode"
        :batch-select-mode="batchSelectMode"
        :selected-asset-ids="selectedAssetIds"
        @update:selected-asset-ids="selectedAssetIds = $event"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Dayjs } from 'dayjs'
import MaterialAssetsContent from '@/views/Project/MaterialAssetsContent.vue'
import { PROJECT_TABS, type ProjectTabKey } from '@/views/Project/projectData'
import type { CanvasAssetDragPayload } from '@/components/Canvas/constants'

const CANVAS_MATERIAL_COLUMN_COUNT = 3

type AssetsFileType = 'all' | 'image' | 'video'

const ASSETS_TYPE_OPTIONS: Array<{ label: string; value: AssetsFileType }> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
]

const props = withDefaults(
  defineProps<{
    tab: ProjectTabKey
    date: any
    type?: AssetsFileType
    projectId?: string
    isLight?: boolean
  }>(),
  {
    type: 'all',
    projectId: undefined,
  },
)

const emit = defineEmits<{
  'update:tab': [tab: ProjectTabKey]
  'update:date': [date: any]
  'update:type': [type: AssetsFileType]
  'batch-insert': [assets: CanvasAssetDragPayload[]]
  close: []
}>()

const batchSelectMode = ref(false)
const selectedAssetIds = ref<string[]>([])
const materialAssetsRef = ref<InstanceType<typeof MaterialAssetsContent> | null>(null)

function onTypeChange(value: unknown) {
  if (value === 'all' || value === 'image' || value === 'video') {
    emit('update:type', value)
  }
}

function onDateChange(value: string | Dayjs | null) {
  if (value === null || value === undefined) {
    emit('update:date', null)
    return
  }
  if (typeof value === 'string') {
    emit('update:date', value)
    return
  }
  emit('update:date', value.format('YYYY-MM-DD'))
}

function enterBatchSelectMode() {
  batchSelectMode.value = true
}

function exitBatchSelectMode() {
  batchSelectMode.value = false
  selectedAssetIds.value = []
}

function onChangeTab(tab: ProjectTabKey) {
  exitBatchSelectMode()
  emit('update:tab', tab)
}

function onClose() {
  exitBatchSelectMode()
  emit('close')
}

function onBatchInsert() {
  const payloads = materialAssetsRef.value?.getSelectedAssetPayloads() ?? []
  if (!payloads.length) return
  emit('batch-insert', payloads)
  exitBatchSelectMode()
}

watch(() => props.tab, () => {
  exitBatchSelectMode()
})
</script>
