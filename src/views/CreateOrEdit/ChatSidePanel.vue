<template>
  <aside
    class="chat-panel"
    :class="{ 'chat-panel--collapsed': collapsed, 'chat-panel--active': isActive }"
    aria-label="对话面板"
  >
    <header class="chat-panel__header">
      <h2 class="chat-panel__title">{{ sessionTitle }}</h2>
      <div class="chat-panel__header-actions">
        <button type="button" class="chat-panel__icon-btn" title="新建对话" aria-label="新建对话" @click="startNewChat">
          <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" />
        </button>
        <button type="button" class="chat-panel__icon-btn" title="历史记录" aria-label="历史记录">
          <span class="chat-panel__icon chat-panel__icon--history" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="chat-panel__icon-btn"
          title="收起面板"
          aria-label="收起面板"
          @click="collapsed = !collapsed"
        >
          <span class="chat-panel__icon chat-panel__icon--collapse" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-show="!collapsed" class="chat-panel__body">
      <section v-if="!isActive" class="chat-panel__welcome">
        <p class="chat-panel__greeting">👋 Hi，用对话开启创作？</p>
        <p class="chat-panel__sub-greeting">或来试一试这些 skill</p>

        <div class="chat-panel__skills">
          <button
            v-for="skill in skills"
            :key="skill"
            type="button"
            class="chat-panel__skill-btn"
            @click="selectSkill(skill)"
          >
            {{ skill }}
          </button>
        </div>

        <p class="chat-panel__hint">你也可以直接拖入 .md 文件导入你的 skill</p>
      </section>

      <section v-else ref="messagesRef" class="chat-panel__messages">
        <article
          v-for="item in messages"
          :key="item.id"
          class="chat-panel__message"
          :class="`chat-panel__message--${item.role}`"
        >
          <div v-if="item.attachments?.length" class="chat-panel__message-attachments">
            <img
              v-for="attachment in item.attachments"
              :key="attachment.id"
              :src="attachment.previewUrl"
              :alt="attachment.fileName"
              class="chat-panel__message-thumb"
            />
          </div>
          <p v-if="item.text" class="chat-panel__message-text">{{ item.text }}</p>
          <p v-if="item.tip" class="chat-panel__message-tip">{{ item.tip }}</p>
        </article>
      </section>

      <footer
        class="chat-panel__composer"
        @dragover.prevent
        @drop.prevent="onComposerDrop"
      >
        <div class="panel__composer_box">
          <div v-if="attachments.length" class="chat-panel__attachments">
            <div
              v-for="attachment in attachments"
              :key="attachment.id"
              class="chat-panel__attachment"
            >
              <img :src="attachment.previewUrl" :alt="attachment.fileName" class="chat-panel__attachment-img" />
              <button
                type="button"
                class="chat-panel__attachment-remove"
                title="移除附件"
                @click="removeAttachment(attachment.id)"
              >
                ×
              </button>
            </div>
          </div>

          <textarea
            ref="inputRef"
            v-model="message"
            class="chat-panel__input"
            :placeholder="inputPlaceholder"
            rows="3"
            @keydown.enter.exact.prevent="sendMessage"
          />

          <div class="chat-panel__composer-bar">
            <input
              ref="fileInputRef"
              type="file"
              class="chat-panel__file-input"
              accept="image/*,.md"
              multiple
              @change="onFileInputChange"
            />
            <button type="button" class="chat-panel__icon-btn chat-panel__icon-btn--sm" title="添加附件" @click="openFilePicker">
              <span class="chat-panel__icon chat-panel__icon--plus" aria-hidden="true" />
            </button>

            <button type="button" class="chat-panel__meta-btn">Models</button>
            <button type="button" class="chat-panel__meta-btn">Skills</button>

            <div class="chat-panel__auto-wrap">
              <button type="button" class="chat-panel__auto-btn" @click="showAutoMenu = !showAutoMenu">
                {{ autoMode }}
                <span class="chat-panel__caret" aria-hidden="true" />
              </button>
              <div v-if="showAutoMenu" class="chat-panel__auto-menu">
                <button
                  v-for="mode in autoModes"
                  :key="mode"
                  type="button"
                  class="chat-panel__auto-item"
                  :class="{ 'chat-panel__auto-item--active': mode === autoMode }"
                  @click="selectAutoMode(mode)"
                >
                  {{ mode }}
                </button>
              </div>
            </div>

            <button
              v-if="isProcessing"
              type="button"
              class="chat-panel__stop"
              title="停止"
              aria-label="停止"
              @click="stopProcessing"
            >
              <span class="chat-panel__stop-icon" aria-hidden="true" />
            </button>
            <button
              v-else
              type="button"
              class="chat-panel__send"
              :disabled="!canSend"
              title="发送"
              aria-label="发送"
              @click="sendMessage"
            >
              <span class="chat-panel__send-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>
    </div>

    <button
      v-if="collapsed"
      type="button"
      class="chat-panel__expand"
      title="展开面板"
      aria-label="展开面板"
      @click="collapsed = false"
    >
      <span class="chat-panel__icon chat-panel__icon--expand" aria-hidden="true" />
    </button>
  </aside>
  <img
    src="@/assets/images/stmsge.png"
    alt="logo"
    class="chat-panel__msg-icon"
    @click="collapsed = false"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ChatAttachment, ChatMessage, ChatSendPayload } from './chatTypes'
import { CHAT_TIPS } from './chatTypes'

const skills = [
  '有声书',
  '剪映导出',
  '电商商品图',
  '图片重混',
  '微短剧剧本',
  '技能创建',
]

const autoModes = ['Auto', 'Fast', 'Quality']

const emit = defineEmits<{
  send: [payload: ChatSendPayload]
  'new-chat': []
}>()

const collapsed = defineModel<boolean>('collapsed', { required: true })

const message = ref('')
const autoMode = ref('Auto')
const showAutoMenu = ref(false)
const isActive = ref(false)
const isProcessing = ref(false)
const sessionTitle = ref('New Chat')
const messages = ref<ChatMessage[]>([])
const attachments = ref<ChatAttachment[]>([])
const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)

const inputPlaceholder = computed(() =>
  isActive.value ? '输入提示词，你的消息将排队...' : '输入消息...',
)

const canSend = computed(() => Boolean(message.value.trim() || attachments.value.length))

function createAttachment(file: File): ChatAttachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    fileName: file.name,
  }
}

function addAttachments(files: File[]) {
  files.forEach((file) => {
    if (!file.type.startsWith('image/') && !file.name.endsWith('.md')) return
    attachments.value.push(createAttachment(file))
  })
}

async function addAttachmentFromCanvas(payload: { previewUrl: string; fileName: string }) {
  if (!payload.previewUrl) return
  if (attachments.value.some((item) => item.previewUrl === payload.previewUrl)) return

  try {
    const response = await fetch(payload.previewUrl)
    const blob = await response.blob()
    const file = new File(
      [blob],
      payload.fileName || 'canvas-image.jpg',
      { type: blob.type || 'image/jpeg' },
    )
    addAttachments([file])
  } catch {
    return
  }

  focusInput()
}

function removeAttachment(id: string) {
  const target = attachments.value.find((item) => item.id === id)
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  attachments.value = attachments.value.filter((item) => item.id !== id)
}

function clearAttachments() {
  attachments.value.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
  attachments.value = []
}

function selectSkill(skill: string) {
  message.value = skill
  focusInput()
}

function selectAutoMode(mode: string) {
  autoMode.value = mode
  showAutoMenu.value = false
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  addAttachments(Array.from(input.files ?? []))
  input.value = ''
}

function onComposerDrop(event: DragEvent) {
  addAttachments(Array.from(event.dataTransfer?.files ?? []))
}

function scrollMessagesToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function sendMessage() {
  if (isProcessing.value || !canSend.value) return

  const text = message.value.trim()
  const payloadAttachments = attachments.value.map((item) => ({ ...item }))
  if (!text && !payloadAttachments.length) return

  if (!isActive.value) {
    sessionTitle.value = text || payloadAttachments[0]?.fileName || 'New Chat'
    isActive.value = true
  }

  messages.value.push({
    id: `msg-${Date.now()}`,
    role: 'user',
    text,
    attachments: payloadAttachments,
    tip: CHAT_TIPS[messages.value.length % CHAT_TIPS.length],
  })

  message.value = ''
  clearAttachments()
  scrollMessagesToBottom()
  emit('send', { text, attachments: payloadAttachments })
}

function stopProcessing() {
  isProcessing.value = false
}

function beginProcessing() {
  isProcessing.value = true
}

function endProcessing() {
  isProcessing.value = false
}

function startNewChat() {
  isActive.value = false
  isProcessing.value = false
  sessionTitle.value = 'New Chat'
  messages.value = []
  message.value = ''
  clearAttachments()
  emit('new-chat')
}

function focusInput() {
  nextTick(() => inputRef.value?.focus())
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.chat-panel__auto-wrap')) {
    showAutoMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  clearAttachments()
})

defineExpose({
  beginProcessing,
  endProcessing,
  focusInput,
  startNewChat,
  addAttachmentFromCanvas,
})
</script>

<style scoped lang="scss">
.chat-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 100vh;
  height: 100dvh;
  border-left: 1px solid #e5e5e5;
  background: #fff;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.06);
  transition: width 0.2s ease;

  &--collapsed {
    width: 0px !important;
  }
}

.chat-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 18px;
  border-bottom: 1px solid #e5e5e5;
}

.chat-panel__title {
  margin: 0;
  overflow: hidden;
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chat-panel__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.chat-panel__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f3f4f6;
  }

  &--sm {
    width: 28px;
    height: 28px;
  }
}

.chat-panel__icon {
  display: block;
  width: 16px;
  height: 16px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;

  &--plus {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M8 3v10M3 8h10'/%3E%3C/svg%3E");
  }

  &--history {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z'/%3E%3Cpath d='M8 5.5V8l1.5 1.5'/%3E%3C/svg%3E");
  }

  &--collapse {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4H4v6M6 8h6'/%3E%3C/svg%3E");
  }

  &--expand {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23374151' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 4h6v6M10 8H4'/%3E%3C/svg%3E");
  }
}

.chat-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.chat-panel__welcome {
  flex: 1;
  min-height: 0;
  padding: 28px 20px 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.chat-panel__greeting {
  margin: 0 0 8px;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.chat-panel__sub-greeting {
  margin: 0 0 20px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.4;
}

.chat-panel__skills {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chat-panel__skill-btn {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.chat-panel__hint {
  margin: 16px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

.chat-panel__messages {
  flex: 1;
  min-height: 0;
  padding: 20px 18px 12px;
  overflow: auto;
}

.chat-panel__message {
  margin-bottom: 18px;
}

.chat-panel__message-text {
  margin: 0;
  color: #111827;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.chat-panel__message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.chat-panel__message-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.chat-panel__message-tip {
  margin: 10px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.5;
}

.chat-panel__composer {
  flex-shrink: 0;
  padding: 0 16px 16px;
}

.chat-panel__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px 8px 16px;
}

.chat-panel__attachment {
  position: relative;
  width: 48px;
  height: 48px;
}

.chat-panel__attachment-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.chat-panel__attachment-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}

.chat-panel__file-input {
  display: none;
}
.panel__composer_box {
  border: 1px solid #e5e5e5;
  border-radius: 14px;
}

.chat-panel__input {
  display: block;
  width: 100%;
  min-height: 96px;
  padding: 14px 16px;
  box-sizing: border-box;
  border: 1px solid #e5e5e5;
  border-radius: 14px;
  background: #fff;
  color: #111827;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  border: none;
  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    // border-color: #d1d5db;
    // box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.04);
    outline: none;
  }

}

.chat-panel__composer-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 10px 12px;
}

.chat-panel__meta-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: #111827;
  }
}

.chat-panel__auto-wrap {
  position: relative;
  margin-left: auto;
}

.chat-panel__auto-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: #f3f4f6;
  }
}

.chat-panel__caret {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 3.5 5 6l2.5-2.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__auto-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 2;
  min-width: 120px;
  padding: 6px;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}

.chat-panel__auto-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #f3f4f6;
    color: #111827;
  }
}

.chat-panel__send,
.chat-panel__stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.chat-panel__send {
  background: #374151;

  &:hover:not(:disabled) {
    background: #111827;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.chat-panel__stop {
  background: #111827;

  &:hover {
    background: #374151;
  }
}

.chat-panel__send-icon {
  display: block;
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 11V3M7 3 3.5 6.5M7 3l3.5 3.5'/%3E%3C/svg%3E") center / contain no-repeat;
}

.chat-panel__stop-icon {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #fff;
}

.chat-panel__expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
}
.chat-panel__msg-icon {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  cursor: pointer;
}
</style>
