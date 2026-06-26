<template>
  <div class="canvas__save-skill-backdrop" @mousedown.self="emit('close')">
    <div
      class="canvas__save-skill-popover"
      :class="{ 'canvas__save-skill-popover--light': isLight }"
      :style="{ left: `${position.left}px`, top: `${position.top}px` }"
      @mousedown.stop
    >
      <div class="canvas__save-skill-tabs">
        <button
          type="button"
          class="canvas__save-skill-tab"
          :class="{ 'canvas__save-skill-tab--active': activeTab === 'new' }"
          @click="activeTab = 'new'"
        >
          新建技能
        </button>
      </div>

      <div v-if="activeTab === 'new'" class="canvas__save-skill-body">
        <label class="canvas__save-skill-field">
          <span class="canvas__save-skill-prefix">@</span>
          <input
            v-model="skillName"
            type="text"
            class="canvas__save-skill-input"
            placeholder="技能名称 (必填)"
          />
        </label>

        <!-- <label class="canvas__save-skill-field canvas__save-skill-field--select">
          <select v-model="skillRole" class="canvas__save-skill-select">
            <option v-for="role in SKILL_ROLE_OPTIONS" :key="role" :value="role">
              {{ role }}
            </option>
          </select>
        </label> -->

        <textarea
          v-model="skillDescription"
          class="canvas__save-skill-textarea"
          rows="4"
          placeholder="输入清晰的描述，帮助 agent 更好地搜索和复用..."
        />

        <div class="canvas__save-skill-files">
          <div
            v-for="item in items"
            :key="item.nodeId"
            class="canvas__save-skill-file"
          >
            <span class="canvas__save-skill-file-icon" aria-hidden="true" />
            <span class="canvas__save-skill-file-name">{{ item.label }}</span>
            <span class="canvas__save-skill-file-arrow" aria-hidden="true">›</span>
          </div>
        </div>

        <!-- <button
          type="button"
          class="canvas__save-skill-tags-toggle"
          @click="showTags = !showTags"
        >
          <span class="canvas__save-skill-tags-caret" :class="{ 'is-open': showTags }">›</span>
          添加标签 (可选)
        </button>
        <input
          v-if="showTags"
          v-model="skillTags"
          type="text"
          class="canvas__save-skill-input canvas__save-skill-input--tags"
          placeholder="多个标签用逗号分隔"
        /> -->
      </div>

      <div v-else class="canvas__save-skill-body">
        <p v-if="!existingSkills.length" class="canvas__save-skill-empty">
          暂无已保存技能，请先新建技能
        </p>
        <div v-else class="canvas__save-skill-existing-list">
          <button
            v-for="skill in existingSkills"
            :key="skill.id"
            type="button"
            class="canvas__save-skill-existing-item"
            :class="{ 'canvas__save-skill-existing-item--active': selectedSkillId === skill.id }"
            @click="selectedSkillId = skill.id"
          >
            <span class="canvas__save-skill-existing-name">{{ skill.name }}</span>
            <span class="canvas__save-skill-existing-meta">
              {{ skill.role }} · {{ skill.fileCount }} 个文件
            </span>
          </button>
        </div>
      </div>

      <div class="canvas__save-skill-footer">
        <button type="button" class="canvas__save-skill-btn canvas__save-skill-btn--ghost" @click="emit('close')">
          取消
        </button>
        <button
          type="button"
          class="canvas__save-skill-btn canvas__save-skill-btn--primary"
          :disabled="!canSubmit || submitting"
          @click="submit"
        >
          {{ activeTab === 'new' ? '创建技能' : '加入技能' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SavedCanvasSkill } from '../skillStorage'

export interface SaveSkillItem {
  nodeId: string
  label: string
}

const SKILL_ROLE_OPTIONS = ['角色', '场景', '风格包', '自定义']

const props = defineProps<{
  position: { left: number; top: number }
  items: SaveSkillItem[]
  existingSkills: SavedCanvasSkill[]
  isLight?: boolean
  submitting?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: {
    tab: 'new' | 'existing'
    name: string
    role: string
    description: string
    tags: string[]
    existingSkillId?: string
  }]
}>()

const activeTab = ref<'new' | 'existing'>('new')
const skillName = ref('')
const skillRole = ref(SKILL_ROLE_OPTIONS[0])
const skillDescription = ref('')
const skillTags = ref('')
const selectedSkillId = ref('')

const canSubmit = computed(() => {
  if (activeTab.value === 'new') {
    return skillName.value.trim().length > 0
  }
  return Boolean(selectedSkillId.value)
})

watch(
  () => props.existingSkills,
  (skills) => {
    if (!selectedSkillId.value && skills.length) {
      selectedSkillId.value = skills[0].id
    }
  },
  { immediate: true },
)

function submit() {
  if (!canSubmit.value || props.submitting) return
  const tags = skillTags.value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (activeTab.value === 'new') {
    emit('submit', {
      tab: 'new',
      name: skillName.value.trim(),
      role: skillRole.value,
      description: skillDescription.value.trim(),
      tags,
    })
    return
  }

  const target = props.existingSkills.find((item) => item.id === selectedSkillId.value)
  if (!target) return
  emit('submit', {
    tab: 'existing',
    name: target.name,
    role: target.role,
    description: target.description,
    tags: target.tags,
    existingSkillId: target.id,
  })
}
</script>
