import type {
  ChatMessage,
  Questionnaire,
  QuestionnaireOption,
  QuestionnaireStep,
} from '../chatTypes'
import type { StreamEvent } from './chatStreamParse'

export type QuestionnaireOptionSource = {
  label?: string
  value?: string
  description?: string
}

export type QuestionnaireStepSource = {
  name?: string
  label?: string
  question?: string
  allowCustom?: boolean
  allowMulti?: boolean
  options?: QuestionnaireOptionSource[]
}

export type QuestionnaireSource = {
  question?: string
  step?: number
  totalSteps?: number
  allowCustom?: boolean
  allowMulti?: boolean
  options?: QuestionnaireOptionSource[]
  steps?: QuestionnaireStepSource[]
}

export function normalizeQuestionnaireOptions(
  options?: QuestionnaireOptionSource[],
): QuestionnaireOption[] {
  if (!options?.length) return []

  return options
    .filter((item): item is QuestionnaireOption => Boolean(item.label && item.value))
    .map((item) => ({
      label: item.label,
      value: item.value,
      description: item.description,
    }))
}

export function normalizeQuestionnaireSteps(
  steps?: QuestionnaireStepSource[],
): QuestionnaireStep[] {
  if (!steps?.length) return []

  const normalized: QuestionnaireStep[] = []
  steps.forEach((step) => {
    const options = normalizeQuestionnaireOptions(step.options)
    if (!options.length) return
    normalized.push({
      name: step.name,
      label: step.label,
      question: step.question || '',
      allowCustom: step.allowCustom ?? false,
      allowMulti: Boolean(step.allowMulti),
      options,
    })
  })
  return normalized
}

export function normalizeQuestionnaire(
  data: QuestionnaireSource | undefined,
  fallbackQuestion?: string,
): Questionnaire | undefined {
  if (!data) return undefined

  const steps = normalizeQuestionnaireSteps(data.steps)
  const stepIndex = Math.max(0, (data.step ?? 1) - 1)
  const activeStep = steps[stepIndex]
  const options = activeStep
    ? activeStep.options
    : normalizeQuestionnaireOptions(data.options)

  if (!options.length) return undefined

  const totalSteps = data.totalSteps ?? (steps.length || 1)
  const step = data.step ?? 1
  const stepQuestion = activeStep?.question || data.question || fallbackQuestion || ''

  return {
    question: data.question || fallbackQuestion || stepQuestion,
    step,
    totalSteps,
    allowCustom: activeStep?.allowCustom ?? data.allowCustom ?? false,
    allowMulti: activeStep?.allowMulti ?? Boolean(data.allowMulti),
    options,
    steps: steps.length ? steps : undefined,
    stepQuestion,
    stepName: activeStep?.name,
    stepLabel: activeStep?.label,
  }
}

export function findQuestionnaireAction(agentActions?: StreamEvent['agentActions']) {
  return agentActions?.find(
    (item) => item.type === 'QUESTIONNAIRE' || item.tool === 'ask_user',
  )
}

export function extractQuestionnaireFromStreamPayload(payload: StreamEvent): Questionnaire | undefined {
  if (payload.tool === 'ask_user' && payload.arguments?.questionnaire) {
    return normalizeQuestionnaire(payload.arguments.questionnaire, payload.arguments.question)
  }

  const action = findQuestionnaireAction(payload.agentActions)
  if (action?.data) {
    return normalizeQuestionnaire(action.data, action.summary || action.data.question)
  }

  return undefined
}

export function extractQuestionnaireFromHistoryItem(item: {
  content?: string
  agentActions?: StreamEvent['agentActions']
}): Questionnaire | undefined {
  const action = findQuestionnaireAction(item.agentActions)
  if (action?.data) {
    return normalizeQuestionnaire(action.data, action.summary || action.data.question)
  }
  return undefined
}

export function resolveQuestionnaireStepKey(step: QuestionnaireStep, index: number) {
  return step.name || `step-${index + 1}`
}

export function resolveCurrentQuestionnaireAnswerKey(message: ChatMessage): string | null {
  const questionnaire = message.questionnaire
  if (!questionnaire) return null

  const stepIndex = Math.max(0, questionnaire.step - 1)
  return questionnaire.stepName
    || (questionnaire.steps?.[stepIndex]
      ? resolveQuestionnaireStepKey(questionnaire.steps[stepIndex], stepIndex)
      : `step-${questionnaire.step}`)
}

export function getQuestionnaireCurrentAnswer(message: ChatMessage): string {
  const answerKey = resolveCurrentQuestionnaireAnswerKey(message)
  if (!answerKey) return ''
  return String(message.questionnaireAnswers?.[answerKey] ?? '').trim()
}

/** 多选答案按英文逗号拆分；单选保持整段匹配 */
export function splitQuestionnaireMultiValues(answer: string): string[] {
  return answer
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function joinQuestionnaireMultiValues(values: string[]): string {
  return values.map((item) => item.trim()).filter(Boolean).join(',')
}

export function hasQuestionnaireCurrentAnswer(message: ChatMessage): boolean {
  return Boolean(getQuestionnaireCurrentAnswer(message))
}

export function isQuestionnaireLastStep(message: ChatMessage): boolean {
  const questionnaire = message.questionnaire
  if (!questionnaire) return true
  if (!questionnaire.steps?.length) return true
  return questionnaire.step >= questionnaire.totalSteps
}

export function isQuestionnaireOptionSelected(
  message: ChatMessage,
  option: QuestionnaireOption,
): boolean {
  const answer = getQuestionnaireCurrentAnswer(message)
  if (!answer) return false
  const optionValue = option.value || option.label
  if (message.questionnaire?.allowMulti) {
    return splitQuestionnaireMultiValues(answer).includes(optionValue)
  }
  return answer === optionValue
}

export function getQuestionnaireCustomDraft(message: ChatMessage): string {
  const answer = getQuestionnaireCurrentAnswer(message)
  if (!answer) return ''
  const options = message.questionnaire?.options ?? []
  if (message.questionnaire?.allowMulti) {
    // 多选时：自定义草稿为答案中不属于预设选项的部分（逗号拼接）
    const optionValues = new Set(options.map((item) => item.value || item.label))
    const customs = splitQuestionnaireMultiValues(answer).filter((item) => !optionValues.has(item))
    return customs.join(',')
  }
  const matched = options.some(
    (option) => (option.value || option.label) === answer,
  )
  return matched ? '' : answer
}

export function setQuestionnaireAnswer(message: ChatMessage, value: string) {
  const answerKey = resolveCurrentQuestionnaireAnswerKey(message)
  if (!answerKey) return

  const answers = { ...(message.questionnaireAnswers ?? {}) }
  const trimmed = value.trim()
  if (trimmed) {
    answers[answerKey] = trimmed
  } else {
    delete answers[answerKey]
  }
  message.questionnaireAnswers = answers
}

export function toggleQuestionnaireMultiOption(message: ChatMessage, option: QuestionnaireOption) {
  const optionValue = (option.value || option.label).trim()
  if (!optionValue) return

  const optionValues = new Set(
    (message.questionnaire?.options ?? []).map((item) => item.value || item.label),
  )
  const current = splitQuestionnaireMultiValues(getQuestionnaireCurrentAnswer(message))
  // 保留自定义片段，仅切换预设选项
  const customs = current.filter((item) => !optionValues.has(item))
  const selected = current.filter((item) => optionValues.has(item))
  const nextSelected = selected.includes(optionValue)
    ? selected.filter((item) => item !== optionValue)
    : [...selected, optionValue]

  setQuestionnaireAnswer(message, joinQuestionnaireMultiValues([...nextSelected, ...customs]))
}

export function applyQuestionnaireStep(message: ChatMessage, stepIndex: number): boolean {
  const questionnaire = message.questionnaire
  if (!questionnaire?.steps?.length) return false

  const nextStep = questionnaire.steps[stepIndex]
  if (!nextStep) return false

  message.questionnaire = {
    ...questionnaire,
    step: stepIndex + 1,
    allowCustom: nextStep.allowCustom,
    allowMulti: Boolean(nextStep.allowMulti),
    options: nextStep.options,
    stepQuestion: nextStep.question,
    stepName: nextStep.name,
    stepLabel: nextStep.label,
  }
  return true
}

/** 按 steps 顺序拼成「平台: 淘宝/天猫\n受众: 年轻女性」 */
export function buildQuestionnaireSubmitContent(message: ChatMessage): string {
  const questionnaire = message.questionnaire
  const answers = message.questionnaireAnswers ?? {}
  if (!questionnaire?.steps?.length) {
    return Object.values(answers).filter(Boolean).join('\n')
  }

  return questionnaire.steps
    .map((step, index) => {
      const key = resolveQuestionnaireStepKey(step, index)
      const value = answers[key]
      if (!value) return ''
      const label = step.label || step.name || `步骤${index + 1}`
      return `${label}: ${value}`
    })
    .filter(Boolean)
    .join('\n')
}
