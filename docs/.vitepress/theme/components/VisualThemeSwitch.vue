<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onMounted, onUnmounted, ref } from 'vue'

type VisualTheme = 'classic' | 'field'

const storageKey = 'ellephants-visual-theme'
const theme = ref<VisualTheme>('classic')
const { isDark } = useData()
const colorModeLabel = computed(() => (isDark.value ? '切换到浅色模式' : '切换到深色模式'))

function applyTheme(nextTheme: VisualTheme, persist = true) {
  theme.value = nextTheme
  document.documentElement.dataset.visualTheme = nextTheme

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  themeColor?.setAttribute('content', nextTheme === 'field' ? '#0b0b09' : '#7a4a21')

  if (persist) {
    try {
      localStorage.setItem(storageKey, nextTheme)
    } catch {
      // Browsing contexts that block storage can still switch for this visit.
    }
  }
}

function syncAcrossTabs(event: StorageEvent) {
  if (event.key !== storageKey) return
  applyTheme(event.newValue === 'field' ? 'field' : 'classic', false)
}

function toggleColorMode() {
  isDark.value = !isDark.value
}

onMounted(() => {
  applyTheme(document.documentElement.dataset.visualTheme === 'field' ? 'field' : 'classic', false)
  window.addEventListener('storage', syncAcrossTabs)
})

onUnmounted(() => window.removeEventListener('storage', syncAcrossTabs))
</script>

<template>
  <div class="appearance-controls" aria-label="外观设置">
    <button
      type="button"
      class="color-mode-toggle"
      :aria-label="colorModeLabel"
      :title="colorModeLabel"
      :aria-pressed="isDark"
      @click="toggleColorMode"
    >
      <span aria-hidden="true">{{ isDark ? '☾' : '☀' }}</span>
    </button>
    <div class="visual-theme-switch" role="group" aria-label="视觉主题">
      <button
        type="button"
        :class="{ active: theme === 'classic' }"
        :aria-pressed="theme === 'classic'"
        title="切换到初始视觉"
        @click="applyTheme('classic')"
      >
        初始
      </button>
      <button
        type="button"
        :class="{ active: theme === 'field' }"
        :aria-pressed="theme === 'field'"
        title="切换到原野视觉"
        @click="applyTheme('field')"
      >
        原野
      </button>
    </div>
  </div>
</template>
