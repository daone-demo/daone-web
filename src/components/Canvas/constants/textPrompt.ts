export const TEXT_PROMPT_MODEL_LABEL = 'GVLM 3.1'

export type TextPromptModelItem = {
  key: string
  name: string
  duration: string
  desc?: string
}

export const TEXT_PROMPT_MODEL_MENU: TextPromptModelItem[] = [
  { key: 'gvlm-3-1', name: '反推提示词', duration: '', desc: '' },
  { key: 'cvlm-5-5', name: '小红书种草文案', duration: '' },
]

export const TEXT_PROMPT_PLACEHOLDER =
  '写下你想讲的故事、场景或角色设定。例如：一个来自未来的机器人，在城市屋顶看星星。'

export const DEFAULT_GENERATION_FAIL_MESSAGE =
  '输出内容未通过安全审核,积分将会在10分钟内返还,请修改描述或者素材后重试'

export function normalizeGenerationFailMessage(_errorMessage?: string): string {
  return DEFAULT_GENERATION_FAIL_MESSAGE
}
