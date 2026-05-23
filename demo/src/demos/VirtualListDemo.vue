<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import { VirtualList } from 'vue-virtual-scroller-kit'
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

/* ── Data generation ──────────────────────────────────────── */
const CATEGORIES = ['Bug Report', 'Feature', 'Docs', 'Refactor', 'Test', 'Chore', 'Security']
const COLORS: Record<string, string> = {
  'Bug Report': 'red', Feature: 'blue', Docs: 'green',
  Refactor: 'purple', Test: 'yellow', Chore: 'yellow', Security: 'red',
}
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const USERS = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'henry']

function randomBetween(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a
}

interface IssueRow {
  id: number
  title: string
  category: string
  priority: string
  author: string
  commentCount: number
  description: string
  createdAt: string
}

function generateIssues(count: number): IssueRow[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => {
    const cat = CATEGORIES[i % CATEGORIES.length]
    const hasDesc = i % 3 !== 0       // 2/3 of rows have a description (variable height)
    return {
      id: i + 1,
      title: `[${cat}] Issue #${i + 1} — ${sampleTitle(i)}`,
      category: cat,
      priority: PRIORITIES[i % PRIORITIES.length],
      author: USERS[i % USERS.length],
      commentCount: randomBetween(0, 42),
      description: hasDesc
        ? `This issue was discovered during the ${['sprint review', 'integration test', 'code review', 'prod deploy'][i % 4]}. ` +
          `Affects the ${['auth', 'dashboard', 'API', 'build pipeline'][i % 4]} module.`
        : '',
      createdAt: new Date(now - i * 60_000 * randomBetween(1, 120)).toLocaleDateString(),
    }
  })
}

function sampleTitle(i: number): string {
  const titles = [
    'Unexpected null reference in parser',
    'Add dark mode support',
    'Update contribution guide',
    'Extract shared utilities',
    'Add unit tests for auth flow',
    'Bump dependencies',
    'XSS in user profile field',
    'Race condition in cache layer',
    'Improve error messages',
    'Performance regression on large datasets',
  ]
  return titles[i % titles.length]
}

/* ── State ────────────────────────────────────────────────── */
const COUNT_OPTIONS = [1_000, 10_000, 100_000]
const count = ref(100_000)
const items = shallowRef<IssueRow[]>(generateIssues(count.value))
const listRef = ref<VirtualListExpose | null>(null)
const jumpIndex = ref(0)
const visibleInfo = ref({ start: 0, end: 0 })
const overscan = ref(3)
const estimatedSize = ref(72)

function changeCount(n: number) {
  count.value = n
  items.value = generateIssues(n)
}

function jumpTo() {
  const idx = Math.min(Math.max(0, jumpIndex.value), items.value.length - 1)
  listRef.value?.scrollTo(idx, 'start')
}

function asIssue(x: unknown): IssueRow { return x as IssueRow }
</script>

<template>
  <div class="demo">
    <!-- Sidebar -->
    <aside class="demo-sidebar">
      <h2 class="demo-sidebar__title">VirtualList</h2>
      <p class="demo-sidebar__desc">
        Flat list with <strong>dynamic row heights</strong> measured via a single
        <code>ResizeObserver</code>. Rows outside <code>visibleRange</code> are
        <em>unmounted</em>, not hidden.
      </p>

      <!-- Stats -->
      <div class="demo-sidebar__stats">
        <div class="demo-stat">
          <strong>{{ count.toLocaleString() }}</strong> rows total
        </div>
        <div class="demo-stat">
          Visible <strong>{{ visibleInfo.end - visibleInfo.start + 1 }}</strong>
          ({{ visibleInfo.start }}–{{ visibleInfo.end }})
        </div>
      </div>

      <!-- Count picker -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Row count</label>
        <div class="demo-sidebar__row">
          <button
            v-for="n in COUNT_OPTIONS"
            :key="n"
            class="demo-btn"
            :class="{ 'demo-btn--primary': count === n }"
            @click="changeCount(n)"
          >
            {{ n.toLocaleString() }}
          </button>
        </div>
      </div>

      <!-- Overscan -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Overscan: {{ overscan }}</label>
        <input v-model.number="overscan" type="range" min="0" max="20" step="1" class="demo-range" />
      </div>

      <!-- Estimated item size -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">estimatedItemSize: {{ estimatedSize }}px</label>
        <input v-model.number="estimatedSize" type="range" min="30" max="200" step="5" class="demo-range" />
      </div>

      <!-- Jump to index -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Jump to index</label>
        <div class="demo-sidebar__row">
          <input
            v-model.number="jumpIndex"
            type="number"
            min="0"
            :max="count - 1"
            class="demo-input"
            @keydown.enter="jumpTo"
          />
          <button class="demo-btn demo-btn--primary" @click="jumpTo">Go</button>
        </div>
      </div>

      <!-- Code snippet -->
      <div class="demo-code">&lt;VirtualList
  :items="items"
  :estimated-item-size="{{ estimatedSize }}"
  :overscan="{{ overscan }}"
  key-field="id"
&gt;
  &lt;template #default="{ item, index, style }"&gt;
    &lt;!-- your row --&gt;
  &lt;/template&gt;
&lt;/VirtualList&gt;</div>
    </aside>

    <!-- List -->
    <div class="demo-viewport">
      <VirtualList
        ref="listRef"
        :items="items"
        key-field="id"
        :estimated-item-size="estimatedSize"
        :overscan="overscan"
        style="height: 100%;"
        @visible-range-change="visibleInfo = $event"
      >
        <template #default="{ item, index }">
          <div class="issue-row" :class="{ 'issue-row--alt': index % 2 === 1 }">
            <div class="issue-row__header">
              <span class="issue-row__id">#{{ asIssue(item).id }}</span>
              <span :class="`demo-badge demo-badge--${COLORS[asIssue(item).category]}`">{{ asIssue(item).category }}</span>
              <span class="demo-tag">{{ asIssue(item).priority }}</span>
              <span class="issue-row__title">{{ asIssue(item).title }}</span>
            </div>
            <p v-if="asIssue(item).description" class="issue-row__desc">{{ asIssue(item).description }}</p>
            <div class="issue-row__meta">
              <span>👤 {{ asIssue(item).author }}</span>
              <span>💬 {{ asIssue(item).commentCount }}</span>
              <span>📅 {{ asIssue(item).createdAt }}</span>
            </div>
          </div>
        </template>

        <template #empty>
          <div class="demo-empty">No issues found.</div>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<style scoped>
.demo {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* Sidebar */
.demo-sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}
.demo-sidebar__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}
.demo-sidebar__desc { color: var(--color-text-muted); font-size: 13px; line-height: 1.6; }
.demo-sidebar__desc code { color: var(--color-primary); font-size: 12px; }
.demo-sidebar__stats { display: flex; flex-direction: column; gap: 6px; }
.demo-sidebar__group { display: flex; flex-direction: column; gap: 6px; }
.demo-sidebar__label { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
.demo-sidebar__row { display: flex; gap: 6px; flex-wrap: wrap; }

/* Viewport */
.demo-viewport {
  flex: 1;
  overflow: hidden;
  background: var(--color-bg);
}

/* Controls */
.demo-range {
  width: 100%;
  accent-color: var(--color-primary);
}
.demo-input {
  flex: 1;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 6px 10px;
  color: var(--color-text);
  font-size: 13px;
  min-width: 0;
}
.demo-input:focus { outline: none; border-color: var(--color-primary); }

/* Issue rows */
.issue-row {
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.issue-row--alt { background: var(--color-surface); }
.issue-row__header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.issue-row__id { font-size: 11px; color: var(--color-text-muted); font-weight: 600; min-width: 36px; }
.issue-row__title { font-size: 13px; flex: 1; }
.issue-row__desc { font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }
.issue-row__meta {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: var(--color-text-muted);
}
.demo-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-muted);
}
</style>
