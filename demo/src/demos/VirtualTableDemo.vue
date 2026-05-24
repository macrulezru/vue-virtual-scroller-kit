<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import VirtualTable from '../../../src/components/VirtualTable.vue'
import { autoColWidths } from '../../../src/utils/autoColWidths'
import type { ColumnDef, SortChange } from '../../../src/types'

/* ── Data generation ──────────────────────────────────────────────────────── */
const ROLES     = ['Admin', 'Developer', 'Designer', 'Analyst', 'Manager', 'Support']
const STATUSES  = ['active', 'inactive', 'pending', 'banned']
const COUNTRIES = ['USA', 'Germany', 'Japan', 'Brazil', 'India', 'France', 'UK', 'Canada']
const PLANS     = ['Free', 'Pro', 'Enterprise']
const FIRST     = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack']
const LAST      = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']

interface UserRow {
  id: number
  name: string
  email: string
  role: string
  status: string
  country: string
  score: number
  joined: string
  lastSeen: string
  plan: string
}

function generateUsers(count: number): UserRow[] {
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST[i % FIRST.length]
    const last  = LAST[i % LAST.length]
    const name  = `${first} ${last}`
    return {
      id: i + 1,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      role: ROLES[i % ROLES.length],
      status: STATUSES[i % STATUSES.length],
      country: COUNTRIES[i % COUNTRIES.length],
      score: Math.round(Math.random() * 1000),
      joined: new Date(Date.now() - i * 86_400_000 * 3).toLocaleDateString(),
      lastSeen: new Date(Date.now() - i * 3_600_000).toLocaleDateString(),
      plan: PLANS[i % PLANS.length],
    }
  })
}

/* ── Row count ────────────────────────────────────────────────────────────── */
const COUNT_OPTIONS = [1_000, 10_000, 50_000]
const count = ref(1_000)
const allRows = shallowRef<UserRow[]>(generateUsers(count.value))

function changeCount(n: number) {
  count.value = n
  allRows.value = generateUsers(n)
  sortStack.value = []
  if (autoWidths.value) recalcWidths()
}

/* ── Sort ─────────────────────────────────────────────────────────────────── */
const multiSort = ref(false)
const sortStack = ref<SortChange[]>([])

const rows = computed<UserRow[]>(() => {
  if (sortStack.value.length === 0) return allRows.value
  return [...allRows.value].sort((a, b) => {
    for (const s of sortStack.value) {
      if (s.direction === null) continue
      const av = a[s.key as keyof UserRow]
      const bv = b[s.key as keyof UserRow]
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
})

function onSortChange(sort: SortChange | SortChange[]) {
  sortStack.value = Array.isArray(sort) ? sort : (sort.direction ? [sort] : [])
}

/* ── Pinned rows ──────────────────────────────────────────────────────────── */
const showPinned = ref(false)

const pinnedTop = computed<UserRow[]>(() =>
  showPinned.value
    ? [{ id: -1, name: '📌 Pinned Top Row', email: 'always@visible.com', role: 'Admin', status: 'active', country: 'USA', score: 9999, joined: '—', lastSeen: '—', plan: 'Enterprise' }]
    : [],
)

const pinnedBottom = computed<UserRow[]>(() =>
  showPinned.value
    ? [{ id: -2, name: '∑ Totals', email: '', role: '', status: 'active', country: '', score: rows.value.reduce((s, r) => s + r.score, 0), joined: '', lastSeen: '', plan: '' }]
    : [],
)

/* ── autoColWidths ────────────────────────────────────────────────────────── */
const autoWidths = ref(false)
const colWidthMap = ref<Map<string, number>>(new Map())

const RAW_COLS: { key: keyof UserRow; title: string }[] = [
  { key: 'id',       title: '#' },
  { key: 'name',     title: 'Name' },
  { key: 'email',    title: 'Email' },
  { key: 'role',     title: 'Role' },
  { key: 'status',   title: 'Status' },
  { key: 'country',  title: 'Country' },
  { key: 'score',    title: 'Score' },
  { key: 'joined',   title: 'Joined' },
  { key: 'lastSeen', title: 'Last seen' },
  { key: 'plan',     title: 'Plan' },
]

function recalcWidths() {
  colWidthMap.value = autoColWidths(
    RAW_COLS.map(c => ({ key: c.key, title: c.title })),
    allRows.value.slice(0, 200),
    { font: '13px sans-serif', padding: 24 },
  )
}

/* ── Columns ──────────────────────────────────────────────────────────────── */
const resizableColumns = ref(false)

const columns = computed((): ColumnDef[] => {
  const getW = (key: keyof UserRow, fallback: number) =>
    autoWidths.value ? (colWidthMap.value.get(key) ?? fallback) : fallback

  return [
    { key: 'id',       title: '#',         width: getW('id', 64),        fixed: 'left' },
    { key: 'name',     title: 'Name',      width: getW('name', 160),     minWidth: 100 },
    { key: 'email',    title: 'Email',     width: getW('email', 200),    minWidth: 140 },
    { key: 'role',     title: 'Role',      width: getW('role', 120) },
    { key: 'status',   title: 'Status',    width: getW('status', 100) },
    { key: 'country',  title: 'Country',   width: getW('country', 120) },
    { key: 'score',    title: 'Score',     width: getW('score', 90) },
    { key: 'joined',   title: 'Joined',    width: getW('joined', 110) },
    { key: 'lastSeen', title: 'Last seen', width: getW('lastSeen', 110) },
    { key: 'plan',     title: 'Plan',      width: getW('plan', 100),     fixed: 'right' },
  ]
})

/* ── Lazy loading simulation ──────────────────────────────────────────────── */
const lazyMode = ref(false)
const lazyRows = ref<UserRow[]>([])
const lazyTotal = ref(0)
const lazyLoading = ref(false)
const LAZY_PAGE = 100
const lazyHasMore = computed(() => lazyRows.value.length < lazyTotal.value)

async function lazyLoad(replace = false) {
  if (lazyLoading.value) return
  lazyLoading.value = true
  await new Promise(r => setTimeout(r, 400))  // simulate network
  const page = replace ? 1 : Math.floor(lazyRows.value.length / LAZY_PAGE) + 1
  const all = generateUsers(5_000)
  const offset = (page - 1) * LAZY_PAGE
  const chunk = all.slice(offset, offset + LAZY_PAGE)
  lazyRows.value = replace ? chunk : [...lazyRows.value, ...chunk]
  lazyTotal.value = all.length
  lazyLoading.value = false
}

function toggleLazy(on: boolean) {
  lazyMode.value = on
  if (on && lazyRows.value.length === 0) lazyLoad(true)
}

/* ── Controls ─────────────────────────────────────────────────────────────── */
const stickyHeader = ref(true)
const stickyOffset = ref(0)
const visibleInfo = ref({ start: 0, end: 0 })

const STATUS_COLOR: Record<string, string> = {
  active: 'green', inactive: 'yellow', pending: 'blue', banned: 'red',
}
const PLAN_COLOR: Record<string, string> = {
  Free: 'yellow', Pro: 'blue', Enterprise: 'purple',
}
</script>

<template>
  <div class="demo">
    <!-- Sidebar -->
    <aside class="demo-sidebar">
      <h2 class="demo-sidebar__title">VirtualTable</h2>
      <p class="demo-sidebar__desc">
        Native <code>&lt;table&gt;</code> with virtual scrolling — spacer rows keep browser column
        width sync automatic. Sticky header, fixed columns, sort, pinned rows, lazy loading,
        auto-width measurement.
      </p>

      <div class="demo-sidebar__stats">
        <div class="demo-stat">
          <strong>{{ (lazyMode ? lazyRows.length : count).toLocaleString() }}</strong>
          <span> / {{ (lazyMode ? lazyTotal : count).toLocaleString() }} rows</span>
        </div>
        <div class="demo-stat">
          Visible <strong>{{ visibleInfo.end - visibleInfo.start + 1 }}</strong>
        </div>
        <div v-if="sortStack.length > 0" class="demo-stat">
          Sort: <strong>{{ sortStack.map(s => `${s.key} ${s.direction}`).join(', ') }}</strong>
        </div>
      </div>

      <!-- Row count (only for static mode) -->
      <div v-if="!lazyMode" class="demo-sidebar__group">
        <label class="demo-sidebar__label">Row count</label>
        <div class="demo-sidebar__row">
          <button
            v-for="n in COUNT_OPTIONS"
            :key="n"
            class="demo-btn"
            :class="{ 'demo-btn--primary': count === n }"
            @click="changeCount(n)"
          >{{ n.toLocaleString() }}</button>
        </div>
      </div>

      <!-- Feature toggles -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Features</label>
        <label class="demo-sidebar__check">
          <input v-model="stickyHeader" type="checkbox" />
          Sticky header
        </label>
        <label class="demo-sidebar__check">
          <input v-model="multiSort" type="checkbox" />
          Multi-column sort <kbd>Shift+click</kbd>
        </label>
        <label class="demo-sidebar__check">
          <input v-model="showPinned" type="checkbox" />
          Pinned top &amp; bottom rows
        </label>
        <label class="demo-sidebar__check">
          <input v-model="resizableColumns" type="checkbox" />
          Resizable columns
        </label>
        <label class="demo-sidebar__check">
          <input
            :checked="autoWidths"
            type="checkbox"
            @change="autoWidths = !autoWidths; if (autoWidths) recalcWidths()"
          />
          autoColWidths — measure content
        </label>
        <label class="demo-sidebar__check">
          <input
            :checked="lazyMode"
            type="checkbox"
            @change="toggleLazy(!lazyMode)"
          />
          Lazy loading (infinite scroll)
        </label>
      </div>

      <!-- Sticky header offset -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Header offset: {{ stickyOffset }}px</label>
        <input v-model.number="stickyOffset" type="range" min="0" max="100" class="demo-range" />
      </div>

      <p class="demo-sidebar__hint">
        Click column header to sort · <kbd>Shift</kbd>+click for multi-sort ·
        Fixed columns <em>#</em> and <em>Plan</em> stay on horizontal scroll.
      </p>
    </aside>

    <!-- Table viewport -->
    <div class="demo-viewport">
      <!-- ── Lazy loading mode ─────────────────────────────────────── -->
      <VirtualTable
        v-if="lazyMode"
        :columns="columns"
        :rows="lazyRows"
        :sticky-header="stickyHeader"
        :sticky-header-offset="stickyOffset"
        :sortable="!multiSort"
        :multi-sort="multiSort"
        :resizable-columns="resizableColumns"
        :estimated-item-size="40"
        :on-load-more="() => lazyLoad(false)"
        :has-more="lazyHasMore"
        :is-loading="lazyLoading"
        :load-more-threshold="200"
        style="height: 100%; background: var(--color-bg); --vvsk-sticky-bg: var(--color-bg)"
        @sort-change="onSortChange"
        @visible-range-change="visibleInfo = $event"
      >
        <template #cell="{ row, column, value }">
          <template v-if="column.key === 'status'">
            <span :class="`demo-badge demo-badge--${STATUS_COLOR[(row as UserRow).status]}`">{{ value }}</span>
          </template>
          <template v-else-if="column.key === 'plan'">
            <span :class="`demo-badge demo-badge--${PLAN_COLOR[(row as UserRow).plan]}`">{{ value }}</span>
          </template>
          <template v-else-if="column.key === 'score'">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="score-bar"><div class="score-bar__fill" :style="{ width: `${(value as number) / 10}%` }" /></div>
              <span>{{ value }}</span>
            </div>
          </template>
          <template v-else>{{ value }}</template>
        </template>
        <template #loading-indicator>
          <div class="load-indicator">Loading more rows…</div>
        </template>
      </VirtualTable>

      <!-- ── Static mode ───────────────────────────────────────────── -->
      <VirtualTable
        v-else
        :columns="columns"
        :rows="rows"
        :sticky-header="stickyHeader"
        :sticky-header-offset="stickyOffset"
        :sortable="!multiSort"
        :multi-sort="multiSort"
        :pinned-top-rows="pinnedTop"
        :pinned-bottom-rows="pinnedBottom"
        :resizable-columns="resizableColumns"
        :estimated-item-size="40"
        style="height: 100%; background: var(--color-bg); --vvsk-sticky-bg: var(--color-bg)"
        @sort-change="onSortChange"
        @visible-range-change="visibleInfo = $event"
      >
        <template #cell="{ row, column, value }">
          <template v-if="column.key === 'status'">
            <span :class="`demo-badge demo-badge--${STATUS_COLOR[(row as UserRow).status]}`">{{ value }}</span>
          </template>
          <template v-else-if="column.key === 'plan'">
            <span :class="`demo-badge demo-badge--${PLAN_COLOR[(row as UserRow).plan]}`">{{ value }}</span>
          </template>
          <template v-else-if="column.key === 'score'">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="score-bar"><div class="score-bar__fill" :style="{ width: `${(value as number) / 10}%` }" /></div>
              <span>{{ value }}</span>
            </div>
          </template>
          <template v-else>{{ value }}</template>
        </template>

        <!-- Custom pinned-bottom cell (totals row) -->
        <template #pinned-cell="{ row, column, position }">
          <strong v-if="position === 'bottom' && column.key === 'score'" style="color: var(--color-primary)">
            {{ (row as UserRow).score.toLocaleString() }}
          </strong>
          <span v-else>{{ (row as UserRow)[column.key as keyof UserRow] }}</span>
        </template>
      </VirtualTable>
    </div>
  </div>
</template>

<style scoped>
.demo { display: flex; height: 100%; overflow: hidden; }

.demo-sidebar {
  width: 290px; flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
}
.demo-sidebar__title { font-size: 18px; font-weight: 700; color: var(--color-primary); margin: 0; }
.demo-sidebar__desc  { color: var(--color-text-muted); font-size: 12px; line-height: 1.6; margin: 0; }
.demo-sidebar__stats { display: flex; flex-direction: column; gap: 4px; }
.demo-sidebar__group { display: flex; flex-direction: column; gap: 8px; }
.demo-sidebar__label { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
.demo-sidebar__check { font-size: 12px; color: var(--color-text-muted); display: flex; align-items: center; gap: 6px; cursor: pointer; }
.demo-sidebar__row   { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-sidebar__hint  { color: var(--color-text-muted); font-size: 11px; line-height: 1.6; margin: 0; margin-top: auto; }
.demo-range { width: 100%; accent-color: var(--color-primary); }

kbd {
  font-size: 10px; padding: 1px 5px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 3px;
}

code { font-family: monospace; font-size: 11px; }

.demo-viewport { flex: 1; overflow: hidden; }

.score-bar { width: 50px; height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
.score-bar__fill { height: 100%; background: var(--color-primary); border-radius: 2px; }

.load-indicator {
  padding: 12px; text-align: center;
  font-size: 12px; color: var(--color-text-muted);
}

/* Override VirtualTable cell styling */
:deep(.vvsk-table__thead) { background: var(--color-surface); }
:deep(.vvsk-table__header-cell) {
  padding: 10px 12px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
:deep(.vvsk-table__cell) {
  padding: 9px 12px;
  border-right: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.vvsk-table__row:hover .vvsk-table__cell) { background: var(--color-surface) !important; }
</style>
