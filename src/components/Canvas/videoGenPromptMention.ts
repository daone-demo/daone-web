export {
  PROMPT_MENTION_REGEX as VIDEO_GEN_MENTION_REGEX,
  createPromptMentionApi,
  needsSpaceBeforeMention,
} from './promptMention'

import { createPromptMentionApi } from './promptMention'

const api = createPromptMentionApi('video-gen-prompt-panel__mention')

export const VIDEO_GEN_MENTION_CLASS = api.mentionClass
export const createMentionSpan = api.createMentionSpan
export const serializePromptEl = api.serializePromptEl
export const renderPromptToEl = api.renderPromptToEl
export const getPlainTextOffset = api.getPlainTextOffset
export const setPlainTextOffset = api.setPlainTextOffset
export const findMentionBeforeCursor = api.findMentionBeforeCursor
export const findMentionAfterCursor = api.findMentionAfterCursor
