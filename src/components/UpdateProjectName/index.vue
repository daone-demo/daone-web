<template>
  <Teleport to="body">
    <Transition name="project-modal-fade">
      <div v-if="open" class="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"
        @mousedown.self="close">
        <div class="project-modal__dialog" @mousedown.stop>
          <button type="button" class="project-modal__close" aria-label="关闭" @click="close">
            ×
          </button>
          <div class="project-modal__body">
            <section class="project-modal__phone">
              <h3 class="project-modal__col-title">修改项目名称</h3>
              <div class="project-modal__field">
                <label class="project-modal__code-wrap">
                  <input v-model="title" type="text" class="project-modal__input" placeholder="请输入项目名称" />
                </label>
              </div>
              <button type="button" class="project-modal__submit" :disabled="!canSubmit"
                @click="submitUpdateProjectName">
                确定
              </button>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import api from '@/services/api'
const title = ref('');
const submitUpdateProjectName = () => {
  const nextTitle = title.value.trim()
  const currentProjectId = projectId.value
  api.updateProject(currentProjectId, { title: nextTitle }).then(() => {
    emit('submit', { projectId: currentProjectId, title: nextTitle })
    title.value = ''
    close()
  })
}

const open = defineModel<boolean>('open', { default: false })
const projectId = defineModel<string>('projectId', { default: '' })
const projectName = defineModel<string>('projectName', { default: '' })

const emit = defineEmits<{
  close: []
  submit: [payload: { projectId: string; title: string }]
}>()

const canSubmit = computed(() => title.value.trim().length > 0)

function close() {
  open.value = false
  emit('close')
}

function lockBodyScroll(locked: boolean) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(open, (visible) => {
  lockBodyScroll(visible)
  if (visible) {
    title.value = projectName.value
    return
  }
  title.value = ''
  projectName.value = ''
})
</script>

<style scoped lang="scss">
@import './index.scss';
</style>