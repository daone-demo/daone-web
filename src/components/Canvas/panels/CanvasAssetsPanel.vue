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
            size="small"
            :disabled="!selectableAssetIds.length"
            @click="toggleSelectAll"
          >
            {{ isAllSelected ? '取消全选' : '全选' }}
          </a-button>
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
          <template v-if="!batchSelectMode && (tab === 'FILES' || tab === 'CENTER')">
            <MaterialAssetsFilterBar
              :scope="tab"
              :type="type"
              :date="date"
              @update:type="onTypeChange"
              @update:date="onDateChange"
            />
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
        :column-count="CANVAS_MATERIAL_COLUMN_COUNT"
        embedded
        :is-light="isLight"
        :enable-drag="!batchSelectMode"
        :batch-select-mode="batchSelectMode"
        :selected-asset-ids="selectedAssetIds"
        @update:selected-asset-ids="selectedAssetIds = $event"
        @update:selectable-asset-ids="selectableAssetIds = $event"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import MaterialAssetsContent from '@/views/Project/MaterialAssetsContent.vue'
import MaterialAssetsFilterBar from '@/views/Project/MaterialAssetsFilterBar.vue'
import { PROJECT_TABS, type AssetsFileType, type ProjectTabKey } from '@/views/Project/projectData'
import type { CanvasAssetDragPayload } from '@/components/Canvas/constants'

const CANVAS_MATERIAL_COLUMN_COUNT = 8

const props = withDefaults(
  defineProps<{
    tab: ProjectTabKey
    date: any
    type?: AssetsFileType
    isLight?: boolean
  }>(),
  {
    type: 'all',
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
const selectableAssetIds = ref<string[]>([])
const materialAssetsRef = ref<InstanceType<typeof MaterialAssetsContent> | null>(null)

const isAllSelected = computed(() => {
  if (!selectableAssetIds.value.length) return false
  const selected = new Set(selectedAssetIds.value)
  return selectableAssetIds.value.every((id) => selected.has(id))
})

function onTypeChange(value: AssetsFileType) {
  emit('update:type', value)
}

function onDateChange(value: string | null) {
  emit('update:date', value)
}

function enterBatchSelectMode() {
  batchSelectMode.value = true
}

function toggleSelectAll() {
  if (!batchSelectMode.value) {
    batchSelectMode.value = true
  }

  if (isAllSelected.value) {
    materialAssetsRef.value?.clearAssetSelection()
    return
  }

  materialAssetsRef.value?.selectAllAssets()
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
