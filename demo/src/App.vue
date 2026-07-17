<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'

const tabs = [
  { id: 'virtual-list',    label: 'VirtualList',        icon: '≡', badge: '100k rows' },
  { id: 'virtual-table',   label: 'VirtualTable',        icon: '⊟', badge: 'multi-sort' },
  { id: 'grouped-list',    label: 'GroupedVirtualList',  icon: '⊞', badge: 'collapsible' },
  { id: 'infinite-loader', label: 'InfiniteLoader',      icon: '↓', badge: 'pagination' },
  { id: 'virtual-tree',    label: 'VirtualTree',         icon: '🌲', badge: 'lazy load' },
  { id: 'virtual-grid',    label: 'VirtualGrid',         icon: '⊡', badge: 'photo grid' },
  { id: 'virtual-select',  label: 'VirtualSelect',       icon: '▾', badge: '10k options' },
  { id: 'composable',      label: 'Composables',         icon: '⚙', badge: 'nav + drag' },
] as const

type TabId = typeof tabs[number]['id']
const activeTab = ref<TabId>('virtual-list')
const dir = ref<'ltr' | 'rtl'>('ltr')

const VirtualListDemo    = defineAsyncComponent(() => import('./demos/VirtualListDemo.vue'))
const VirtualTableDemo   = defineAsyncComponent(() => import('./demos/VirtualTableDemo.vue'))
const GroupedListDemo    = defineAsyncComponent(() => import('./demos/GroupedListDemo.vue'))
const InfiniteLoaderDemo = defineAsyncComponent(() => import('./demos/InfiniteLoaderDemo.vue'))
const VirtualTreeDemo    = defineAsyncComponent(() => import('./demos/VirtualTreeDemo.vue'))
const VirtualGridDemo    = defineAsyncComponent(() => import('./demos/VirtualGridDemo.vue'))
const VirtualSelectDemo  = defineAsyncComponent(() => import('./demos/VirtualSelectDemo.vue'))
const ComposableDemo     = defineAsyncComponent(() => import('./demos/ComposableDemo.vue'))

const componentMap = {
  'virtual-list':    VirtualListDemo,
  'virtual-table':   VirtualTableDemo,
  'grouped-list':    GroupedListDemo,
  'infinite-loader': InfiniteLoaderDemo,
  'virtual-tree':    VirtualTreeDemo,
  'virtual-grid':    VirtualGridDemo,
  'virtual-select':  VirtualSelectDemo,
  'composable':      ComposableDemo,
}
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="app-header">
      <div class="app-header__brand">
        <span class="app-header__logo">⚡</span>
        <span class="app-header__name">vue-virtual-scroller-kit</span>
      </div>
      <button
        class="app-header__dir-toggle"
        :aria-pressed="dir === 'rtl'"
        @click="dir = dir === 'ltr' ? 'rtl' : 'ltr'"
      >
        Direction: {{ dir.toUpperCase() }}
      </button>
    </header>

    <!-- Tabs -->
    <nav class="app-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="app-tabs__tab"
        :class="{ 'app-tabs__tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <span class="app-tabs__icon">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
        <span class="demo-badge demo-badge--blue" style="font-size:10px">{{ tab.badge }}</span>
      </button>
    </nav>

    <!-- Content -->
    <main class="app-content" :dir="dir">
      <Suspense>
        <component :is="componentMap[activeTab]" />
        <template #fallback>
          <div class="app-loading">Loading demo…</div>
        </template>
      </Suspense>
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
}
.app-header__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-header__logo { font-size: 20px; }
.app-header__name {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-primary);
}
.app-header__dir-toggle {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
}
.app-header__dir-toggle[aria-pressed='true'] {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.app-tabs {
  display: flex;
  gap: 2px;
  padding: 10px 20px 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  flex-shrink: 0;
  overflow-x: auto;
}
.app-tabs__tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
}
.app-tabs__tab:hover { color: var(--color-text); background: var(--color-surface-2); }
.app-tabs__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background: var(--color-surface-2);
}
.app-tabs__icon { font-size: 16px; }

.app-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 15px;
}
</style>
