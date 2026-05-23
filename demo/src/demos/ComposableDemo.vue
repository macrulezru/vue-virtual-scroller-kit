<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVirtualKeyboardNav, useDraggableList } from '../../../src/index'
import VirtualList from '../../../src/components/VirtualList.vue'

/* ── Demo tabs ──────────────────────────────────────────────── */
const activeDemo = ref<'keyboard' | 'drag'>('keyboard')

/* ── Keyboard Navigation Demo ───────────────────────────────── */
interface NavItem {
  id: number
  label: string
  icon: string
}

const navItems = ref<NavItem[]>(
  Array.from({ length: 500 }, (_, i) => ({
    id: i,
    label: `Item ${i + 1} — press Enter to activate`,
    icon: ['📄', '📁', '🖼️', '🎵', '📦'][i % 5],
  })),
)

const listRef = ref()
const activatedItem = ref<NavItem | null>(null)

const { focusedIndex, setFocus, isFocused } = useVirtualKeyboardNav({
  itemCount: computed(() => navItems.value.length),
  scrollTo: (i, align) => listRef.value?.scrollTo(i, align),
  onActivate: (i) => {
    activatedItem.value = navItems.value[i]
  },
  loop: false,
})

/* ── Drag to Reorder Demo ───────────────────────────────────── */
interface DragItem {
  id: number
  label: string
  color: string
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#22c55e', '#f97316', '#06b6d4', '#eab308', '#ef4444']

const dragItems = ref<DragItem[]>(
  Array.from({ length: 50 }, (_, i) => ({
    id: i,
    label: `Card ${i + 1}`,
    color: COLORS[i % COLORS.length],
  })),
)

const dragListRef = ref<HTMLElement | null>(null)

const { dragIndex, isDragging, ghostStyle, getItemStyle, getItemProps } = useDraggableList<DragItem>({
  items: dragItems,
  scrollContainer: dragListRef,
  onReorder: (newItems) => {
    dragItems.value = newItems
  },
})
</script>

<template>
  <div class="demo-layout">
    <div class="demo-sidebar">
      <h2 class="demo-title">Composables</h2>
      <p class="demo-description">
        Low-level composables for keyboard navigation and drag-to-reorder,
        usable with any list component.
      </p>

      <div class="demo-tabs">
        <button
          class="demo-tab"
          :class="{ 'demo-tab--active': activeDemo === 'keyboard' }"
          @click="activeDemo = 'keyboard'"
        >
          ⌨ Keyboard Nav
        </button>
        <button
          class="demo-tab"
          :class="{ 'demo-tab--active': activeDemo === 'drag' }"
          @click="activeDemo = 'drag'"
        >
          ↕ Drag Reorder
        </button>
      </div>

      <template v-if="activeDemo === 'keyboard'">
        <div class="demo-info">
          <p>Click the list to focus, then use:</p>
          <ul>
            <li><kbd>↑ ↓</kbd> Move focus</li>
            <li><kbd>Home / End</kbd> First / last</li>
            <li><kbd>PgUp / PgDn</kbd> Jump ±10</li>
            <li><kbd>Enter / Space</kbd> Activate</li>
          </ul>
        </div>
        <div v-if="focusedIndex >= 0" class="demo-stat">
          Focused: <strong>#{{ focusedIndex + 1 }}</strong>
        </div>
        <div v-if="activatedItem" class="demo-stat">
          Activated: <strong>{{ activatedItem.label }}</strong>
        </div>
        <div class="demo-controls">
          <button class="demo-btn" @click="setFocus(0)">Go to first</button>
          <button class="demo-btn" @click="setFocus(navItems.length - 1)">Go to last</button>
          <button class="demo-btn" @click="setFocus(Math.floor(navItems.length / 2))">Go to middle</button>
        </div>
      </template>

      <template v-else>
        <div class="demo-info">
          <p>Drag and drop any card to reorder.</p>
          <p>Works with pointer events — no HTML5 drag API.</p>
        </div>
        <div class="demo-stat">
          {{ dragItems.length }} cards
        </div>
        <button class="demo-btn" @click="dragItems = dragItems.slice().reverse()">Reverse order</button>
      </template>
    </div>

    <div class="demo-main">
      <!-- Keyboard Navigation -->
      <template v-if="activeDemo === 'keyboard'">
        <p class="demo-hint">Click the list below to focus it, then navigate with arrow keys</p>
        <div class="nav-list-wrapper" tabindex="0">
          <VirtualList
            ref="listRef"
            :items="navItems"
            :estimated-item-size="48"
            style="height: 100%"
          >
            <template #default="{ item, index }">
              <div
                class="nav-item"
                :class="{
                  'nav-item--focused': isFocused(index),
                  'nav-item--activated': activatedItem?.id === (item as NavItem).id,
                }"
                role="option"
                :aria-selected="isFocused(index)"
                @click="setFocus(index)"
              >
                <span class="nav-item__icon">{{ (item as NavItem).icon }}</span>
                <span class="nav-item__label">{{ (item as NavItem).label }}</span>
                <span v-if="isFocused(index)" class="nav-item__badge">focused</span>
              </div>
            </template>
          </VirtualList>
        </div>
      </template>

      <!-- Drag Reorder -->
      <template v-else>
        <div ref="dragListRef" class="drag-list">
          <div
            v-for="(item, index) in dragItems"
            :key="item.id"
            v-bind="getItemProps(index)"
            class="drag-card"
            :style="[{ borderLeftColor: item.color }, getItemStyle(index)]"
          >
            <span class="drag-handle">⣿</span>
            <span class="drag-card__label">{{ item.label }}</span>
            <span class="drag-card__index">#{{ index + 1 }}</span>
          </div>
        </div>

        <Teleport to="body">
          <div
            v-if="isDragging && dragIndex >= 0"
            class="drag-ghost"
            :style="[{ borderLeftColor: dragItems[dragIndex]?.color }, ghostStyle]"
          >
            <span class="drag-handle">⣿</span>
            <span class="drag-card__label">{{ dragItems[dragIndex]?.label }}</span>
            <span class="drag-card__index">#{{ dragIndex + 1 }}</span>
          </div>
        </Teleport>
      </template>
    </div>
  </div>
</template>

<style scoped>
.demo-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.demo-sidebar {
  width: 250px;
  flex-shrink: 0;
  padding: 20px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.demo-main {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.demo-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--color-primary);
}

.demo-description {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.demo-tabs {
  display: flex;
  gap: 4px;
}

.demo-tab {
  flex: 1;
  padding: 6px 10px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.demo-tab--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.demo-info {
  font-size: 12px;
  padding: 10px;
  background: var(--color-surface-2);
  border-radius: 6px;
  color: var(--color-text-muted);
}

.demo-info p { margin: 0 0 6px; }
.demo-info ul { margin: 0; padding-left: 16px; line-height: 1.9; }

kbd {
  font-size: 10px;
  padding: 1px 5px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
}

.demo-stat {
  font-size: 12px;
  padding: 6px 10px;
  background: var(--color-surface-2);
  border-radius: 6px;
}

.demo-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.demo-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
}

/* Keyboard nav list */
.nav-list-wrapper {
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  outline: none;
}

.nav-list-wrapper:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgb(99 102 241 / 0.25);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 48px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.1s;
}

.nav-item:hover { background: var(--color-surface-2); }

.nav-item--focused {
  background: rgb(99 102 241 / 0.15) !important;
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.nav-item--activated {
  background: rgb(99 102 241 / 0.08);
}

.nav-item__icon { font-size: 16px; flex-shrink: 0; }
.nav-item__label { flex: 1; font-size: 13px; }
.nav-item__badge {
  font-size: 10px;
  padding: 2px 7px;
  background: var(--color-primary);
  color: white;
  border-radius: 10px;
}

/* Drag list */
.drag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  height: 100%;
}

.drag-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid;
  border-radius: 8px;
  cursor: grab;
  user-select: none;
  will-change: transform;
}

.drag-card:hover {
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
}

.drag-ghost {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-primary);
  border-left: 4px solid;
  border-radius: 8px;
  cursor: grabbing;
  user-select: none;
}

.drag-handle {
  font-size: 16px;
  opacity: 0.35;
  cursor: grab;
  flex-shrink: 0;
}

.drag-card__label { flex: 1; font-size: 14px; font-weight: 500; }
.drag-card__index { font-size: 12px; color: var(--color-text-muted); }
</style>
