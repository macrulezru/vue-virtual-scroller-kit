<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue'
import VirtualTable from '../../../src/components/VirtualTable.vue'
import type { ColumnDef, SortChange } from '../../../src/types'

/* ── Columns ──────────────────────────────────────────────── */
const columns: ColumnDef[] = [
  { key: 'id',       title: '#',          width: 64,  fixed: 'left' },
  { key: 'name',     title: 'Name',       minWidth: 160 },
  { key: 'email',    title: 'Email',      minWidth: 200 },
  { key: 'role',     title: 'Role',       width: 120 },
  { key: 'status',   title: 'Status',     width: 100 },
  { key: 'country',  title: 'Country',    width: 120 },
  { key: 'score',    title: 'Score',      width: 90 },
  { key: 'joined',   title: 'Joined',     width: 110 },
  { key: 'lastSeen', title: 'Last seen',  width: 110 },
  { key: 'plan',     title: 'Plan',       width: 100, fixed: 'right' },
]

/* ── Data ─────────────────────────────────────────────────── */
const ROLES    = ['Admin', 'Developer', 'Designer', 'Analyst', 'Manager', 'Support']
const STATUSES = ['active', 'inactive', 'pending', 'banned']
const COUNTRIES = ['USA', 'Germany', 'Japan', 'Brazil', 'India', 'France', 'UK', 'Canada']
const PLANS    = ['Free', 'Pro', 'Enterprise']
const FIRST    = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack']
const LAST     = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']

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

const COUNT_OPTIONS = [1_000, 10_000, 50_000]
const count = ref(1_000)
const allRows = shallowRef<UserRow[]>(generateUsers(count.value))

function changeCount(n: number) {
  count.value = n
  allRows.value = generateUsers(n)
  sortStack.value = []
}

/* ── Sort ─────────────────────────────────────────────────── */
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
  if (Array.isArray(sort)) {
    sortStack.value = sort
  } else {
    sortStack.value = sort.direction ? [sort] : []
  }
}

/* ── Pinned rows ──────────────────────────────────────────── */
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

/* ── Column resizing ──────────────────────────────────────── */
const resizableColumns = ref(false)

/* ── Controls ─────────────────────────────────────────────── */
const stickyHeader = ref(true)
const stickyOffset = ref(0)
const visibleInfo = ref({ start: 0, end: 0 })

const STATUS_COLOR: Record<string, string> = {
  active: 'green', inactive: 'yellow', pending: 'blue', banned: 'red'
}
const PLAN_COLOR: Record<string, string> = {
  Free: 'yellow', Pro: 'blue', Enterprise: 'purple'
}
</script>

<template>
  <div class="demo">
    <!-- Sidebar -->
    <aside class="demo-sidebar">
      <h2 class="demo-sidebar__title">VirtualTable</h2>
      <p class="demo-sidebar__desc">
        Virtual table with sticky header, fixed columns, multi-column sort,
        pinned rows, and resizable columns.
      </p>

      <div class="demo-sidebar__stats">
        <div class="demo-stat">
          <strong>{{ count.toLocaleString() }}</strong> rows
        </div>
        <div class="demo-stat">
          Visible <strong>{{ visibleInfo.end - visibleInfo.start + 1 }}</strong>
        </div>
        <div v-if="sortStack.length > 0" class="demo-stat">
          Sort: <strong>{{ sortStack.map(s => `${s.key} ${s.direction}`).join(', ') }}</strong>
        </div>
      </div>

      <div class="demo-sidebar__group">
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

      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label" style="display:flex;align-items:center;gap:8px">
          <input v-model="stickyHeader" type="checkbox" />
          Sticky header
        </label>
        <label class="demo-sidebar__label" style="display:flex;align-items:center;gap:8px">
          <input v-model="multiSort" type="checkbox" />
          Multi-column sort (Shift+click)
        </label>
        <label class="demo-sidebar__label" style="display:flex;align-items:center;gap:8px">
          <input v-model="showPinned" type="checkbox" />
          Pinned top &amp; bottom rows
        </label>
        <label class="demo-sidebar__label" style="display:flex;align-items:center;gap:8px">
          <input v-model="resizableColumns" type="checkbox" />
          Resizable columns
        </label>
      </div>

      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Header offset: {{ stickyOffset }}px</label>
        <input v-model.number="stickyOffset" type="range" min="0" max="100" class="demo-range" />
      </div>

      <p class="demo-sidebar__desc" style="font-size:11px;margin-top:auto">
        Click a column to sort. Hold <kbd>Shift</kbd> while clicking for multi-column sort.
        Fixed columns (#, Plan) stay in place on horizontal scroll.
      </p>
    </aside>

    <!-- Table -->
    <div class="demo-viewport">
      <VirtualTable
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
        style="height: 100%; background: var(--color-bg);"
        @sort-change="onSortChange"
        @visible-range-change="visibleInfo = $event"
      >
        <!-- Custom header cell -->
        <template #header-cell="{ column }">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--color-text-muted)">
            {{ column.title }}
          </span>
        </template>

        <!-- Custom cells -->
        <template #cell="{ row, column, value }">
          <template v-if="column.key === 'status'">
            <span :class="`demo-badge demo-badge--${STATUS_COLOR[(row as UserRow).status]}`">
              {{ value }}
            </span>
          </template>
          <template v-else-if="column.key === 'plan'">
            <span :class="`demo-badge demo-badge--${PLAN_COLOR[(row as UserRow).plan]}`">
              {{ value }}
            </span>
          </template>
          <template v-else-if="column.key === 'score'">
            <div style="display:flex;align-items:center;gap:6px">
              <div class="score-bar">
                <div class="score-bar__fill" :style="{ width: `${(value as number) / 10}%` }" />
              </div>
              <span>{{ value }}</span>
            </div>
          </template>
          <template v-else>{{ value }}</template>
        </template>
      </VirtualTable>
    </div>
  </div>
</template>

<style scoped>
.demo { display: flex; height: 100%; overflow: hidden; }

.demo-sidebar {
  width: 280px; flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  padding: 20px;
  display: flex; flex-direction: column; gap: 18px;
  overflow-y: auto;
}
.demo-sidebar__title { font-size: 18px; font-weight: 700; color: var(--color-primary); margin: 0; }
.demo-sidebar__desc  { color: var(--color-text-muted); font-size: 13px; line-height: 1.6; margin: 0; }
.demo-sidebar__stats { display: flex; flex-direction: column; gap: 6px; }
.demo-sidebar__group { display: flex; flex-direction: column; gap: 8px; }
.demo-sidebar__label { font-size: 12px; color: var(--color-text-muted); font-weight: 600; cursor: pointer; }
.demo-sidebar__row   { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-range { width: 100%; accent-color: var(--color-primary); }

kbd {
  font-size: 10px;
  padding: 1px 5px;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: 3px;
}

.demo-viewport { flex: 1; overflow: hidden; }

.score-bar {
  width: 50px; height: 4px;
  background: var(--color-border);
  border-radius: 2px; overflow: hidden;
}
.score-bar__fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.2s;
}

:deep(.vvsk-table__header) {
  background: var(--color-surface) !important;
  border-bottom: 1px solid var(--color-border);
}
:deep(.vvsk-table__header-cell) {
  padding: 10px 12px;
  border-right: 1px solid var(--color-border);
  display: flex; align-items: center; gap: 4px;
  background: var(--color-surface);
  min-width: 80px;
}
:deep(.vvsk-table__cell) {
  padding: 9px 12px;
  border-right: 1px solid var(--color-border);
  display: flex; align-items: center;
  font-size: 13px;
  min-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--color-bg);
}
:deep(.vvsk-table__cell--pinned) {
  background: rgb(99 102 241 / 0.08) !important;
}
</style>
