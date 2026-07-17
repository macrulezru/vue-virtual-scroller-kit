<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import { GroupedVirtualList } from 'vue-virtual-scroller-kit'
import type { GroupDef } from 'vue-virtual-scroller-kit'

/* ── Data ─────────────────────────────────────────────────── */
interface Developer {
  id: number
  name: string
  login: string
  stars: number
  repos: number
  language: string
}

const CONTINENTS = [
  { key: 'north-america', label: '🌎 North America' },
  { key: 'europe',        label: '🌍 Europe' },
  { key: 'asia',          label: '🌏 Asia' },
  { key: 'south-america', label: '🌎 South America' },
  { key: 'africa',        label: '🌍 Africa' },
  { key: 'oceania',       label: '🌏 Oceania' },
]

const LANGS = ['TypeScript', 'Rust', 'Go', 'Python', 'Elixir', 'Zig', 'Swift', 'Kotlin']
const FIRST = ['Alex', 'Lena', 'Marc', 'Soo', 'Priya', 'Dmitri', 'Yuki', 'Rosa', 'Omar', 'Finn']
const LAST  = ['Chen', 'Park', 'Novak', 'Silva', 'Ahmed', 'Müller', 'Tanaka', 'Lee', 'Moore']

function generateGroups(perGroup: number): GroupDef<Developer>[] {
  let id = 1
  return CONTINENTS.map((c) => ({
    key: c.key,
    label: c.label,
    collapsed: false,
    items: Array.from({ length: perGroup }, (_, i) => ({
      id: id++,
      name: `${FIRST[(id + i) % FIRST.length]} ${LAST[(id + i) % LAST.length]}`,
      login: `user_${id + i}`,
      stars: Math.floor(Math.random() * 50_000),
      repos: Math.floor(Math.random() * 300) + 1,
      language: LANGS[(id + i) % LANGS.length],
    })),
  }))
}

const PER_GROUP_OPTIONS = [10, 100, 500, 2_000]
const perGroup = ref(100)
const groups = shallowRef<GroupDef<Developer>[]>(generateGroups(perGroup.value))

function changePerGroup(n: number) {
  perGroup.value = n
  groups.value = generateGroups(n)
}

const totalCount = computed(() =>
  groups.value.reduce((s, g) => s + g.items.length, 0)
)

const visibleInfo = ref({ start: 0, end: 0 })
const stickyGroupHeaders = ref(false)
const listRef = ref<{ toggle: (groupKey: string) => void; scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => void } | null>(null)

function collapseAll() {
  groups.value = groups.value.map(g => ({ ...g, collapsed: true }))
}
function expandAll() {
  groups.value = groups.value.map(g => ({ ...g, collapsed: false }))
}

const LANG_COLOR: Record<string, string> = {
  TypeScript: 'blue', Rust: 'red', Go: 'blue', Python: 'yellow',
  Elixir: 'purple', Zig: 'yellow', Swift: 'red', Kotlin: 'purple',
}
</script>

<template>
  <div class="demo">
    <aside class="demo-sidebar">
      <h2 class="demo-sidebar__title">GroupedVirtualList</h2>
      <p class="demo-sidebar__desc">
        Groups with <strong>sticky headers</strong>. Collapsing a group
        triggers an instant <code>PositionManager</code> recalc — no full re-render.
      </p>

      <div class="demo-sidebar__stats">
        <div class="demo-stat">
          <strong>{{ groups.length }}</strong> groups ·
          <strong>{{ totalCount.toLocaleString() }}</strong> items total
        </div>
        <div class="demo-stat">
          Visible rows <strong>{{ visibleInfo.end - visibleInfo.start + 1 }}</strong>
        </div>
      </div>

      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Items per group</label>
        <div class="demo-sidebar__row">
          <button
            v-for="n in PER_GROUP_OPTIONS"
            :key="n"
            class="demo-btn"
            :class="{ 'demo-btn--primary': perGroup === n }"
            @click="changePerGroup(n)"
          >{{ n.toLocaleString() }}</button>
        </div>
      </div>

      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Quick actions</label>
        <div class="demo-sidebar__row">
          <button class="demo-btn" @click="expandAll">Expand all</button>
          <button class="demo-btn" @click="collapseAll">Collapse all</button>
        </div>
      </div>

      <div class="demo-sidebar__group">
        <label class="demo-sidebar__checkbox">
          <input v-model="stickyGroupHeaders" type="checkbox" />
          Sticky group headers (overlay)
        </label>
      </div>

      <div class="demo-code">&lt;GroupedVirtualList
  :groups="groups"
  :estimated-item-size="56"
  :estimated-group-header-size="44"
&gt;
  &lt;template #group-header="{ group, toggle, isCollapsed }"&gt;
    &lt;!-- custom header --&gt;
  &lt;/template&gt;
  &lt;template #default="{ item, groupKey }"&gt;
    &lt;!-- item row --&gt;
  &lt;/template&gt;
&lt;/GroupedVirtualList&gt;</div>
    </aside>

    <div class="demo-viewport">
      <GroupedVirtualList
        ref="listRef"
        :groups="groups"
        :estimated-item-size="56"
        :estimated-group-header-size="44"
        :sticky-group-headers="stickyGroupHeaders"
        style="height: 100%; --vvsk-sticky-bg: var(--color-surface)"
        @visible-range-change="visibleInfo = $event"
      >
        <!-- Custom group header -->
        <template #group-header="{ group, toggle, isCollapsed }">
          <div class="group-header" @click="toggle">
            <span class="group-header__chevron" :class="{ 'group-header__chevron--collapsed': isCollapsed }">▼</span>
            <span class="group-header__label">{{ group?.label }}</span>
            <span class="demo-badge demo-badge--blue">
              {{ group?.items.length.toLocaleString() }} devs
            </span>
            <span v-if="isCollapsed" class="demo-tag">collapsed</span>
          </div>
        </template>

        <!-- Developer row -->
        <template #default="{ item }">
          <div class="dev-row">
            <div class="dev-row__avatar">
              {{ (item as Developer).name[0] }}
            </div>
            <div class="dev-row__info">
              <div class="dev-row__name">{{ (item as Developer).name }}</div>
              <div class="dev-row__login">@{{ (item as Developer).login }}</div>
            </div>
            <div class="dev-row__stats">
              <span class="dev-row__stat">⭐ {{ (item as Developer).stars.toLocaleString() }}</span>
              <span class="dev-row__stat">📁 {{ (item as Developer).repos }}</span>
            </div>
            <span :class="`demo-badge demo-badge--${LANG_COLOR[(item as Developer).language] ?? 'blue'}`">
              {{ (item as Developer).language }}
            </span>
          </div>
        </template>

        <template #empty>
          <div style="padding:40px;text-align:center;color:var(--color-text-muted)">
            No developers found.
          </div>
        </template>
      </GroupedVirtualList>
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
.demo-sidebar__title { font-size: 18px; font-weight: 700; color: var(--color-primary); }
.demo-sidebar__desc  { color: var(--color-text-muted); font-size: 13px; line-height: 1.6; }
.demo-sidebar__desc code { color: var(--color-primary); font-size: 12px; }
.demo-sidebar__stats { display: flex; flex-direction: column; gap: 6px; }
.demo-sidebar__group { display: flex; flex-direction: column; gap: 6px; }
.demo-sidebar__label { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
.demo-sidebar__row   { display: flex; gap: 6px; flex-wrap: wrap; }
.demo-sidebar__checkbox { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; }

.demo-viewport { flex: 1; overflow: hidden; background: var(--color-bg); }

/* Group header */
.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 44px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
  position: sticky;
  top: 0;
  z-index: 2;
}
.group-header:hover { background: var(--color-surface-2); }
.group-header__chevron {
  font-size: 11px;
  color: var(--color-primary);
  transition: transform .2s;
}
.group-header__chevron--collapsed { transform: rotate(-90deg); }
.group-header__label { font-size: 14px; font-weight: 600; flex: 1; }

/* Dev row */
.dev-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px;
  border-bottom: 1px solid var(--color-border);
  height: 56px;
}
.dev-row__avatar {
  width: 34px; height: 34px; flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary-dim);
  color: var(--color-primary);
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.dev-row__info { flex: 1; min-width: 0; }
.dev-row__name  { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dev-row__login { font-size: 11px; color: var(--color-text-muted); }
.dev-row__stats { display: flex; gap: 12px; }
.dev-row__stat  { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
</style>
