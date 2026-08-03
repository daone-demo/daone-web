<template>
  <div v-if="showFilters" class="material-assets-filter-bar">
    <template v-if="scope === 'FILES'">
      <a-date-picker
        :value="date"
        value-format="YYYY-MM-DD"
        format="YYYY-MM-DD"
        allow-clear
        placeholder="选择日期"
        @update:value="onDateChange"
      />
    </template>
    <a-select
      :value="type"
      style="width: 100px"
      @update:value="onTypeChange"
    >
      <a-select-option
        v-for="item in ASSETS_TYPE_OPTIONS"
        :key="item.value"
        :value="item.value"
      >
        {{ item.label }}
      </a-select-option>
    </a-select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Dayjs } from 'dayjs'
import {
  ASSETS_TYPE_OPTIONS,
  normalizeAssetDateValue,
  type AssetsFileType,
  type ProjectTabKey,
} from './projectData'

const props = withDefaults(
  defineProps<{
    scope: ProjectTabKey
    type?: AssetsFileType
    date?: unknown
  }>(),
  {
    type: 'all',
    date: null,
  },
)

const emit = defineEmits<{
  'update:type': [type: AssetsFileType]
  'update:date': [date: string | null]
}>()

const showFilters = computed(() => props.scope === 'FILES' || props.scope === 'CENTER')

function onTypeChange(value: unknown) {
  if (value === 'all' || value === 'image' || value === 'video') {
    emit('update:type', value)
  }
}

function onDateChange(value: string | Dayjs | null) {
  emit('update:date', normalizeAssetDateValue(value))
}
</script>

<style scoped lang="scss">
.material-assets-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
</style>
