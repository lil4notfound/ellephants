<script setup lang="ts">
import type { ContentOrigin } from '../../../content.data'

defineProps<{
  modelValue: 'all' | ContentOrigin
  counts: { all: number; original: number; resource: number }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'all' | ContentOrigin]
}>()

const options = [
  { value: 'all' as const, label: '全部' },
  { value: 'original' as const, label: '原创内容' },
  { value: 'resource' as const, label: '资源导览' }
]
</script>

<template>
  <div class="origin-filter" role="group" aria-label="内容来源">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="{ active: modelValue === option.value }"
      :aria-pressed="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      <span>{{ option.label }}</span>
      <small>{{ counts[option.value] }}</small>
    </button>
  </div>
</template>
