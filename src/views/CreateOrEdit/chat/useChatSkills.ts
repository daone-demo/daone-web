import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

export interface ChatSkillItem {
  id: string
  name: string
  command: string
  description: string
  detail?: string
}

export function detectSlashQuery(text: string) {
  const match = text.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/)
  return match ? match[1] : null
}

export interface UseChatSkillsOptions {
  aiSkills: MaybeRefOrGetter<unknown[] | null | undefined>
  message: Ref<string>
  ensureActiveSession: () => unknown
  focusInput: () => void
  closeModelMenu?: () => void
  showAutoMenu?: Ref<boolean>
}

export function useChatSkills(options: UseChatSkillsOptions) {
  const skills = computed(() =>
    (toValue(options.aiSkills) ?? []).filter(
      (item) => (item as Record<string, unknown>).category == 'CUSTOM',
    ),
  )

  const filteredChatSkills = computed(() =>
    (toValue(options.aiSkills) ?? []).filter(
      (item) => (item as Record<string, unknown>).category == 'ecommerce',
    ),
  )

  const showSkillMenu = ref(false)
  const skillMenuFromButton = ref(false)
  const selectedSkill = ref<Record<string, any> | ChatSkillItem | null>(null)
  const skillChipSelected = ref(false)
  const hoveredSkill = ref<Record<string, any> | ChatSkillItem | null>(null)
  const skillTooltipStyle = ref<Record<string, string>>({})
  const skillTooltipText = computed(() => {
    const skill = hoveredSkill.value
    if (!skill) return ''
    return String(skill.detail || skill.description || '').trim()
  })

  function closeSkillMenu() {
    showSkillMenu.value = false
    skillMenuFromButton.value = false
    hoveredSkill.value = null
  }

  function toggleSkillMenu() {
    const next = !showSkillMenu.value
    showSkillMenu.value = next
    skillMenuFromButton.value = next
    if (next) {
      options.closeModelMenu?.()
      if (options.showAutoMenu) options.showAutoMenu.value = false
    } else {
      hoveredSkill.value = null
    }
  }

  function resolveEnabledSkill(skill: any) {
    const name = String(skill?.name ?? skill?.skillName ?? '').trim()
    if (!name) return skill
    return filteredChatSkills.value.find(
      (item) => (item as Record<string, unknown>).name === name,
    ) ?? skill
  }

  function selectChatSkill(skill: ChatSkillItem | Record<string, any>) {
    selectedSkill.value = skill
    skillChipSelected.value = false
    options.message.value = options.message.value
      .replace(/(^|\s)\/[a-zA-Z0-9-]*$/, '')
      .trimStart()
    closeSkillMenu()
    options.focusInput()
  }

  function selectWelcomeSkill(skill: Record<string, any>) {
    options.ensureActiveSession()
    selectChatSkill(resolveEnabledSkill(skill))
  }

  function selectSkillChip() {
    skillChipSelected.value = true
    options.focusInput()
  }

  function clearSelectedSkill() {
    selectedSkill.value = null
    skillChipSelected.value = false
  }

  function onSkillItemEnter(event: MouseEvent, skill: ChatSkillItem) {
    hoveredSkill.value = skill
    const target = event.currentTarget as HTMLElement | null
    if (!target) return
    const rect = target.getBoundingClientRect()
    skillTooltipStyle.value = {
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.left - 12}px`,
      transform: 'translate(-100%, -50%)',
    }
  }

  function onSkillItemLeave() {
    hoveredSkill.value = null
  }

  function onMessageInput() {
    skillChipSelected.value = false
    const slashQuery = detectSlashQuery(options.message.value)
    if (slashQuery !== null || options.message.value === '/') {
      showSkillMenu.value = true
      options.closeModelMenu?.()
      if (options.showAutoMenu) options.showAutoMenu.value = false
      return
    }
    if (!skillMenuFromButton.value) {
      closeSkillMenu()
    }
  }

  function getSelectedSkillDescription(): string {
    const skill = selectedSkill.value
    if (!skill) return ''
    return String(skill.description ?? skill.detail ?? '').trim()
  }

  return {
    skills,
    filteredChatSkills,
    showSkillMenu,
    skillMenuFromButton,
    selectedSkill,
    skillChipSelected,
    hoveredSkill,
    skillTooltipStyle,
    skillTooltipText,
    detectSlashQuery,
    closeSkillMenu,
    toggleSkillMenu,
    resolveEnabledSkill,
    selectChatSkill,
    selectWelcomeSkill,
    selectSkillChip,
    clearSelectedSkill,
    onSkillItemEnter,
    onSkillItemLeave,
    onMessageInput,
    getSelectedSkillDescription,
  }
}
