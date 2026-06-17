import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** 全局可管理的弹窗类型，新增弹窗时在此扩展 */
export type ModalKey = 'login' | 'combo'

type ModalPayloadMap = {
  login: undefined
  combo: undefined
}

export const useModalStore = defineStore('modal', () => {
  const visible = ref<Record<ModalKey, boolean>>({
    login: false,
    combo: false,
  })

  const payload = ref<Partial<{ [K in ModalKey]: ModalPayloadMap[K] }>>({})

  const activeKeys = computed(() =>
    (Object.keys(visible.value) as ModalKey[]).filter((key) => visible.value[key]),
  )

  const hasOpenModal = computed(() => activeKeys.value.length > 0)

  const loginVisible = computed({
    get: () => visible.value.login,
    set: (value: boolean) => {
      if (value) {
        openModal('login')
      } else {
        closeModal('login')
      }
    },
  })

  const comboVisible = computed({
    get: () => visible.value.combo,
    set: (value: boolean) => {
      if (value) {
        openModal('combo')
      } else {
        closeModal('combo')
      }
    },
  })

  function isModalOpen(key: ModalKey) {
    return visible.value[key]
  }

  function openModal<K extends ModalKey>(
    key: K,
    data?: ModalPayloadMap[K],
  ) {
    visible.value[key] = true
    if (data !== undefined) {
      payload.value[key] = data
    }
  }

  function closeModal(key?: ModalKey) {
    if (key) {
      visible.value[key] = false
      delete payload.value[key]
      return
    }
    ;(Object.keys(visible.value) as ModalKey[]).forEach((k) => {
      visible.value[k] = false
    })
    payload.value = {}
  }

  function getPayload<K extends ModalKey>(key: K): ModalPayloadMap[K] | undefined {
    return payload.value[key]
  }

  function toggleModal<K extends ModalKey>(key: K, data?: ModalPayloadMap[K]) {
    if (visible.value[key]) {
      closeModal(key)
    } else {
      openModal(key, data)
    }
  }

  return {
    visible,
    payload,
    activeKeys,
    hasOpenModal,
    loginVisible,
    comboVisible,
    isModalOpen,
    openModal,
    closeModal,
    getPayload,
    toggleModal,
  }
})
