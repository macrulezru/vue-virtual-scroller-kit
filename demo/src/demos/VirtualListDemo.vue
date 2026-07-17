<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import { VirtualList, VirtualScrollbar, useVisibilityTracker } from 'vue-virtual-scroller-kit'
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
const motionBlur = ref(false)
const smoothScroll = ref(false)
const layout = ref<'vertical' | 'horizontal'>('vertical')

function changeCount(n: number) {
  count.value = n
  items.value = generateIssues(n)
}

function setLayout(next: 'vertical' | 'horizontal') {
  if (layout.value === next) return
  layout.value = next
  estimatedSize.value = next === 'horizontal' ? 220 : 72
}

function jumpTo() {
  const idx = Math.min(Math.max(0, jumpIndex.value), items.value.length - 1)
  listRef.value?.scrollTo(idx, 'start', { behavior: smoothScroll.value ? 'smooth' : 'auto' })
}

function asIssue(x: unknown): IssueRow { return x as IssueRow }

// A flat estimatedItemSize is a poor fit here: 2/3 of rows carry an extra description
// paragraph that adds real height, so a single number systematically underestimates the
// true average — which is exactly what makes scrollTo() land far short on a distant,
// unrendered row (see scrollToWatched below). Estimating per-row instead (still driven by
// the same slider as a base) keeps the manager's un-measured offsets close to reality.
const estimatedItemSizeProp = computed(():
  | number
  | ((item: unknown, index: number) => number) => {
  if (layout.value === 'horizontal') return estimatedSize.value
  const base = estimatedSize.value
  return (item: unknown) => (asIssue(item).description ? base + 24 : base)
})

/* ── Watchlist (useVisibilityTracker demo) ───────────────────
 * Star any row to "watch" it — the sidebar entry lights up the instant that row's
 * element intersects the list's scroll container, and dims the instant it scrolls
 * back out. Backed by IntersectionObserver via useVisibilityTracker, not by
 * comparing visibleRange (which would be thrown off by the overscan buffer). */
function makeDefaultWatched(rows: IssueRow[]): Map<number, IssueRow> {
  const ids = [1, Math.min(50_000, rows.length), Math.min(95_000, rows.length)]
  const m = new Map<number, IssueRow>()
  for (const id of ids) {
    const row = rows[id - 1]
    if (row) m.set(row.id, row)
  }
  return m
}

const watched = ref<Map<number, IssueRow>>(makeDefaultWatched(items.value))
const rowEls = new Map<number, Element>()
const tracker = useVisibilityTracker({
  root: () => listRef.value?.getScrollElement() ?? null,
})

function toggleWatch(row: IssueRow) {
  const next = new Map(watched.value)
  if (next.has(row.id)) {
    next.delete(row.id)
    tracker.unobserve(row.id)
  } else {
    next.set(row.id, row)
    const el = rowEls.get(row.id)
    if (el) tracker.observe(el, row.id)
  }
  watched.value = next
}

function onRowMount(el: Element, id: number) {
  rowEls.set(id, el)
  if (watched.value.has(id)) tracker.observe(el, id)
}

function onRowUnmount(id: number) {
  rowEls.delete(id)
  tracker.unobserve(id)
}

function isIndexInView(index: number): boolean {
  return index >= visibleInfo.value.start && index <= visibleInfo.value.end
}

async function scrollToWatched(row: IssueRow) {
  const targetIndex = row.id - 1
  if (isIndexInView(targetIndex)) return

  const current = visibleInfo.value.start
  const viewportRows = Math.max(1, visibleInfo.value.end - visibleInfo.value.start + 1)
  const direction = Math.sign(targetIndex - current) // 1 = scrolling down, -1 = scrolling up

  // Two-phase scroll, coarse-to-fine:
  //  1. Land instantly one screen short of the target, on the side we're approaching
  //     from. estimatedItemSizeProp above already accounts for the description paragraph
  //     that 2/3 of rows carry, so even a 100k-row instant jump lands close to reality —
  //     but landing *exactly* on the target would leave nothing for step 2 to animate,
  //     which reads as a flat teleport rather than a scroll. Holding back by one
  //     viewport's worth of rows guarantees a real, visible glide next.
  //  2. Glide that last screen in smoothly, arriving from the correct direction — this is
  //     the part that actually looks like "scrolling to" rather than "jumping to". Fired
  //     right after step 1 with no artificial delay: `el.scrollTop` updates synchronously
  //     for `behavior: 'auto'`, so the smooth animation already starts from the
  //     just-landed position rather than the original one.
  if (Math.abs(targetIndex - current) > viewportRows) {
    const preIndex = Math.min(
      items.value.length - 1,
      Math.max(0, targetIndex - direction * viewportRows),
    )
    listRef.value?.scrollTo(preIndex, 'center', { behavior: 'auto' })
  }

  listRef.value?.scrollTo(targetIndex, 'center', { behavior: 'smooth' })
  await new Promise((r) => setTimeout(r, 500))

  // Rare fallback: the estimate is close but not exact, so on an unlucky measurement the
  // smooth glide can still land just short. A single instant correction — not a repeated
  // stutter — closes that gap.
  if (!isIndexInView(targetIndex)) {
    listRef.value?.scrollTo(targetIndex, 'center', { behavior: 'auto' })
  }
}
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

      <!-- Layout -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Layout</label>
        <div class="demo-sidebar__row">
          <button
            class="demo-btn"
            :class="{ 'demo-btn--primary': layout === 'vertical' }"
            @click="setLayout('vertical')"
          >
            Vertical
          </button>
          <button
            class="demo-btn"
            :class="{ 'demo-btn--primary': layout === 'horizontal' }"
            @click="setLayout('horizontal')"
          >
            Horizontal
          </button>
        </div>
        <p class="demo-sidebar__desc">
          Horizontal mode virtualizes along <code>scrollLeft</code>/<code>clientWidth</code>
          instead — same engine, same RTL handling (try the global Direction toggle).
        </p>
      </div>

      <!-- Overscan -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Overscan: {{ overscan }}</label>
        <input v-model.number="overscan" type="range" min="0" max="20" step="1" class="demo-range" />
      </div>

      <!-- Estimated item size -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">
          estimatedItemSize: {{ estimatedSize }}px ({{ layout === 'horizontal' ? 'card width' : 'row height' }})
        </label>
        <input
          v-model.number="estimatedSize"
          type="range"
          :min="layout === 'horizontal' ? 140 : 30"
          :max="layout === 'horizontal' ? 320 : 200"
          step="5"
          class="demo-range"
        />
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
        <label class="demo-sidebar__checkbox">
          <input v-model="smoothScroll" type="checkbox" />
          Smooth scroll (native <code>behavior: 'smooth'</code>)
        </label>
      </div>

      <!-- Motion blur -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__checkbox">
          <input v-model="motionBlur" type="checkbox" />
          Motion blur while scrolling fast
        </label>
      </div>

      <!-- Watchlist (useVisibilityTracker) -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Watchlist ({{ watched.size }})</label>
        <p class="demo-sidebar__desc">
          Star any row (☆) to watch it. Backed by <code>useVisibilityTracker</code>
          (real <code>IntersectionObserver</code>) — the dot below turns on the instant
          that row scrolls into view, and off the instant it scrolls out.
        </p>
        <p v-if="watched.size === 0" class="demo-sidebar__desc">No watched issues yet.</p>
        <ul v-else class="demo-watchlist">
          <li
            v-for="row in [...watched.values()]"
            :key="row.id"
            class="demo-watchlist__item"
            :class="{ 'demo-watchlist__item--visible': tracker.isVisible(row.id) }"
            @click="scrollToWatched(row)"
          >
            <span class="demo-watchlist__dot" />
            <span class="demo-watchlist__title">#{{ row.id }} {{ row.title }}</span>
            <button
              class="demo-watchlist__remove"
              title="Stop watching"
              @click.stop="toggleWatch(row)"
            >
              ✕
            </button>
          </li>
        </ul>
      </div>

      <!-- Code snippet -->
      <div class="demo-code">&lt;VirtualList
  :items="items"
  :estimated-item-size="{{ estimatedSize }}"
  :overscan="{{ overscan }}"<template v-if="layout === 'horizontal'">
  horizontal</template>
  key-field="id"
&gt;
  &lt;template #default="{ item, index, style }"&gt;
    &lt;!-- your row --&gt;
  &lt;/template&gt;
&lt;/VirtualList&gt;</div>
    </aside>

    <!-- List -->
    <div
      class="demo-viewport"
      :class="{ 'demo-viewport--horizontal': layout === 'horizontal' }"
      style="position: relative"
    >
      <VirtualList
        :key="layout"
        ref="listRef"
        :items="items"
        key-field="id"
        :estimated-item-size="estimatedItemSizeProp"
        :overscan="overscan"
        :motion-blur="motionBlur"
        :horizontal="layout === 'horizontal'"
        style="height: 100%; flex: 1; min-width: 0; min-height: 0"
        @visible-range-change="visibleInfo = $event"
      >
        <template #default="{ item, index }">
          <div
            v-if="layout === 'horizontal'"
            class="issue-card"
            :class="{ 'issue-card--alt': index % 2 === 1, 'issue-card--watched': watched.has(asIssue(item).id) }"
            :style="{ width: estimatedSize + 'px' }"
            :ref="(el) => el && onRowMount(el as Element, asIssue(item).id)"
            @vue:unmounted="onRowUnmount(asIssue(item).id)"
          >
            <div class="issue-card__header">
              <span class="issue-row__id">#{{ asIssue(item).id }}</span>
              <span :class="`demo-badge demo-badge--${COLORS[asIssue(item).category]}`">{{ asIssue(item).category }}</span>
              <button
                class="issue-row__watch"
                :class="{ 'issue-row__watch--active': watched.has(asIssue(item).id) }"
                title="Watch this issue"
                @click.stop="toggleWatch(asIssue(item))"
              >
                {{ watched.has(asIssue(item).id) ? '★' : '☆' }}
              </button>
            </div>
            <span class="demo-tag">{{ asIssue(item).priority }}</span>
            <p class="issue-card__title">{{ asIssue(item).title }}</p>
            <p v-if="asIssue(item).description" class="issue-card__desc">{{ asIssue(item).description }}</p>
            <div class="issue-card__meta">
              <span>👤 {{ asIssue(item).author }}</span>
              <span>💬 {{ asIssue(item).commentCount }}</span>
            </div>
          </div>
          <div
            v-else
            class="issue-row"
            :class="{ 'issue-row--alt': index % 2 === 1, 'issue-row--watched': watched.has(asIssue(item).id) }"
            :ref="(el) => el && onRowMount(el as Element, asIssue(item).id)"
            @vue:unmounted="onRowUnmount(asIssue(item).id)"
          >
            <div class="issue-row__header">
              <span class="issue-row__id">#{{ asIssue(item).id }}</span>
              <span :class="`demo-badge demo-badge--${COLORS[asIssue(item).category]}`">{{ asIssue(item).category }}</span>
              <span class="demo-tag">{{ asIssue(item).priority }}</span>
              <span class="issue-row__title">{{ asIssue(item).title }}</span>
              <button
                class="issue-row__watch"
                :class="{ 'issue-row__watch--active': watched.has(asIssue(item).id) }"
                title="Watch this issue"
                @click.stop="toggleWatch(asIssue(item))"
              >
                {{ watched.has(asIssue(item).id) ? '★' : '☆' }}
              </button>
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

      <VirtualScrollbar
        :target="() => listRef?.getScrollElement() ?? null"
        :orientation="layout === 'horizontal' ? 'horizontal' : 'vertical'"
      />
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
.demo-sidebar__checkbox { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; }
.demo-sidebar__checkbox code { color: var(--color-primary); font-size: 11px; }

/* Watchlist */
.demo-watchlist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.demo-watchlist__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius);
  background: var(--color-surface-2);
  font-size: 12px;
  cursor: pointer;
}
.demo-watchlist__item:hover { background: var(--color-surface); }
.demo-watchlist__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  opacity: 0.4;
  transition: background-color 150ms ease-out, opacity 150ms ease-out;
}
.demo-watchlist__item--visible .demo-watchlist__dot {
  background: #22c55e;
  opacity: 1;
  box-shadow: 0 0 6px #22c55e;
}
.demo-watchlist__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.demo-watchlist__remove {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  line-height: 1;
}
.demo-watchlist__remove:hover { color: var(--color-text); }

/* Viewport */
.demo-viewport {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--color-bg);
}
.demo-viewport--horizontal {
  flex-direction: column;
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
.issue-row--watched { border-inline-start: 3px solid #eab308; }
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
.issue-row__watch {
  margin-inline-start: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  color: var(--color-text-muted);
  padding: 2px;
}
.issue-row__watch--active { color: #eab308; }
/* Issue cards (horizontal layout) */
.issue-card {
  height: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border-inline-end: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.issue-card--alt { background: var(--color-surface); }
.issue-card--watched { border-block-start: 3px solid #eab308; }
.issue-card__header { display: flex; align-items: center; gap: 6px; }
.issue-card__title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.issue-card__desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.issue-card__meta {
  margin-top: auto;
  display: flex;
  gap: 10px;
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
