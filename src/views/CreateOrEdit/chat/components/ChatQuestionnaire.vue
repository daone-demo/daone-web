<template>
  <div
    v-if="message.questionnaire && !message.questionnaireAnswered"
    class="chat-panel__questionnaire"
  >
    <p
      v-if="message.questionnaire.totalSteps > 1"
      class="chat-panel__questionnaire-step"
    >
      第 {{ message.questionnaire.step }} / {{ message.questionnaire.totalSteps }} 步
    </p>
    <p
      v-if="message.questionnaire.stepQuestion"
      class="chat-panel__questionnaire-question"
    >
      {{ message.questionnaire.stepQuestion }}
    </p>
    <button
      v-for="option in message.questionnaire.options"
      :key="`${message.questionnaire.step}-${option.value}`"
      type="button"
      class="chat-panel__questionnaire-option"
      :class="{ 'is-selected': isQuestionnaireOptionSelected(message, option) }"
      :disabled="disabled"
      @click="emit('pick-option', option)"
    >
      <span class="chat-panel__questionnaire-option-label">{{ option.label }}</span>
      <span
        v-if="option.description"
        class="chat-panel__questionnaire-option-desc"
      >{{ option.description }}</span>
    </button>
    <div
      v-if="message.questionnaire.allowCustom"
      class="chat-panel__questionnaire-custom"
    >
      <input
        type="text"
        class="chat-panel__questionnaire-custom-input"
        :value="getQuestionnaireCustomDraft(message)"
        :disabled="disabled"
        placeholder="在此处输入自定义内容"
        @input="onCustomInput"
      >
    </div>
    <div class="chat-panel__questionnaire-nav">
      <button
        v-if="message.questionnaire.step > 1"
        type="button"
        class="chat-panel__questionnaire-nav-btn"
        :disabled="disabled"
        @click="emit('prev')"
      >
        上一步
      </button>
      <button
        type="button"
        class="chat-panel__questionnaire-nav-btn chat-panel__questionnaire-nav-btn--primary"
        :disabled="disabled || !hasQuestionnaireCurrentAnswer(message)"
        @click="emit('next')"
      >
        {{ isQuestionnaireLastStep(message) ? '提交' : '下一步' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage, QuestionnaireOption } from '../../chatTypes'
import {
  getQuestionnaireCustomDraft,
  hasQuestionnaireCurrentAnswer,
  isQuestionnaireLastStep,
  isQuestionnaireOptionSelected,
} from '../chatQuestionnaire'

defineProps<{
  message: ChatMessage
  disabled: boolean
}>()

const emit = defineEmits<{
  'pick-option': [option: QuestionnaireOption]
  'custom-input': [value: string]
  prev: []
  next: []
}>()

function onCustomInput(event: Event) {
  emit('custom-input', (event.target as HTMLInputElement).value)
}
</script>
