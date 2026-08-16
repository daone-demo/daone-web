import { ref } from 'vue'
import { message } from 'ant-design-vue'
import api, { type PromptTranslationData } from '@/services/api'
import { isRequestError } from '@/utils/request'

interface UsePromptTranslateOptions {
  getText: () => string
  onTranslated: (text: string) => void
}

export function usePromptTranslate(options: UsePromptTranslateOptions) {
  const translating = ref(false)

  async function onTranslatePrompt() {
    const text = options.getText().trim()
    if (!text) {
      message.warning('请输入需要翻译的提示词')
      return
    }
    if (translating.value) return

    translating.value = true
    try {
      const result = await api.translatePrompt<PromptTranslationData>({
        text,
        targetLanguage: 'EN',
      })
      const translated = result?.translatedText?.trim()
      if (!translated) {
        message.warning('翻译结果为空')
        return
      }
      options.onTranslated(translated)
    } catch (error) {
      message.error(isRequestError(error) ? error.message : '提示词翻译失败，请稍后重试')
    } finally {
      translating.value = false
    }
  }

  return {
    translating,
    onTranslatePrompt,
  }
}
