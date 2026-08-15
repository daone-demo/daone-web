<template>
  <section class="chat-panel__welcome">
    <p class="chat-panel__greeting">Hi，用对话开启创作</p>
    <p class="chat-panel__sub-greeting">或来试一试这些 skill</p>

    <div class="chat-panel__skills">
      <button
        v-for="skill in skills"
        :key="skill.id"
        type="button"
        class="chat-panel__skill-btn"
        @click="emit('select-skill', skill)"
      >
        {{ skill.displayName }}
      </button>
    </div>

    <!-- <p class="chat-panel__hint">你也可以直接拖入 .md 文件导入你的 skill</p> -->
  </section>
</template>

<script setup lang="ts">
defineProps<{
  skills: any[]
}>()

const emit = defineEmits<{
  'select-skill': [skill: any]
}>()
</script>
