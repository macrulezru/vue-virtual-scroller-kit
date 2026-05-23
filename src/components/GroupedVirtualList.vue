<script setup lang="ts" generic="T">
import { computed, onUnmounted, ref, watch } from 'vue'
import VirtualList from './VirtualList.vue'
import type { GroupDef, VirtualListExpose, VirtualRow } from '../types'

const props = withDefaults(
  defineProps<{
    groups: GroupDef<T>[]
    estimatedItemSize?: number
    estimatedGroupHeaderSize?: number
    overscan?: number
    keyField?: string
  }>(),
  {
    estimatedItemSize: 50,
    estimatedGroupHeaderSize: 40,
    overscan: 3,
    keyField: 'id',
  },
)

defineEmits<{
  'visible-range-change': [range: { start: number; end: number }]
  scroll: [event: Event]
}>()

const listRef = ref<VirtualListExpose | null>(null)

const ANIM_MS = 220

// Track collapsed state per group key
const collapsedGroups = ref<Set<string>>(
  new Set(props.groups.filter((g) => g.collapsed).map((g) => g.key)),
)
// Groups currently mid-animation
const collapsingGroups = ref<Set<string>>(new Set())
const expandingGroups = ref<Set<string>>(new Set())
const animTimers = new Map<string, ReturnType<typeof setTimeout>>()

watch(
  () => props.groups,
  (groups) => {
    // Trust g.collapsed directly: collapseAll/expandAll set it explicitly on every group.
    collapsedGroups.value = new Set(groups.filter((g) => g.collapsed).map((g) => g.key))
    // Bulk prop change: skip animations, clear any in-progress state
    collapsingGroups.value = new Set()
    expandingGroups.value = new Set()
    for (const id of animTimers.values()) clearTimeout(id)
    animTimers.clear()
  },
  { deep: false },
)

// Flatten groups into a virtual row array.
// Items from collapsingGroups are kept in the list while they animate out.
const flatRows = computed<VirtualRow<T>[]>(() => {
  const rows: VirtualRow<T>[] = []
  let idx = 0
  for (const group of props.groups) {
    rows.push({ type: 'header', index: idx++, groupKey: group.key, groupLabel: group.label })
    const fullyCollapsed =
      collapsedGroups.value.has(group.key) && !collapsingGroups.value.has(group.key)
    if (!fullyCollapsed) {
      for (const item of group.items) {
        rows.push({ type: 'item', index: idx++, item, groupKey: group.key })
      }
    }
  }
  return rows
})

function toggle(groupKey: string): void {
  // Clear any in-progress timer so we don't get conflicting state mutations
  const existing = animTimers.get(groupKey)
  if (existing !== undefined) clearTimeout(existing)

  if (collapsedGroups.value.has(groupKey)) {
    // Fully collapsed → expand
    const s = new Set(collapsedGroups.value)
    s.delete(groupKey)
    collapsedGroups.value = s

    const e = new Set(expandingGroups.value)
    e.add(groupKey)
    expandingGroups.value = e

    const id = setTimeout(() => {
      animTimers.delete(groupKey)
      if (!expandingGroups.value.has(groupKey)) return
      const s2 = new Set(expandingGroups.value)
      s2.delete(groupKey)
      expandingGroups.value = s2
    }, ANIM_MS)
    animTimers.set(groupKey, id)
  } else if (collapsingGroups.value.has(groupKey)) {
    // Mid-collapse → reverse to expand
    const c = new Set(collapsingGroups.value)
    c.delete(groupKey)
    collapsingGroups.value = c

    const e = new Set(expandingGroups.value)
    e.add(groupKey)
    expandingGroups.value = e

    const id = setTimeout(() => {
      animTimers.delete(groupKey)
      if (!expandingGroups.value.has(groupKey)) return
      const s2 = new Set(expandingGroups.value)
      s2.delete(groupKey)
      expandingGroups.value = s2
    }, ANIM_MS)
    animTimers.set(groupKey, id)
  } else {
    // Open (or mid-expand) → collapse
    const e = new Set(expandingGroups.value)
    e.delete(groupKey)
    expandingGroups.value = e

    const c = new Set(collapsingGroups.value)
    c.add(groupKey)
    collapsingGroups.value = c

    const id = setTimeout(() => {
      animTimers.delete(groupKey)
      if (!collapsingGroups.value.has(groupKey)) return
      const c2 = new Set(collapsingGroups.value)
      c2.delete(groupKey)
      collapsingGroups.value = c2
      const s2 = new Set(collapsedGroups.value)
      s2.add(groupKey)
      collapsedGroups.value = s2
    }, ANIM_MS)
    animTimers.set(groupKey, id)
  }
}

function isCollapsed(groupKey: string): boolean {
  // Report as collapsed immediately when collapsing starts, so the chevron rotates at once
  return collapsedGroups.value.has(groupKey) || collapsingGroups.value.has(groupKey)
}

onUnmounted(() => {
  for (const id of animTimers.values()) clearTimeout(id)
})

function getRowKey(row: VirtualRow<T>, index: number): string {
  if (row.type === 'header') return `header-${row.groupKey}`
  const field = props.keyField as keyof T
  const item = row.item as Record<string, unknown>
  const val = item?.[field as string]
  return val != null ? `item-${row.groupKey}-${val}` : `item-${index}`
}

// Cast helpers — keeps <T> out of template to avoid Prettier's HTML parser issue
function asRow(row: unknown): VirtualRow<T> {
  return row as VirtualRow<T>
}
function isHeaderRow(row: unknown): boolean {
  return (row as VirtualRow<T>).type === 'header'
}
function rowGroup(row: unknown) {
  const r = row as VirtualRow<T>
  return props.groups.find((g) => g.key === r.groupKey)
}
function rowGroupKey(row: unknown): string {
  return (row as VirtualRow<T>).groupKey!
}
function rowGroupLabel(row: unknown): string {
  return (row as VirtualRow<T>).groupLabel ?? ''
}
function rowItem(row: unknown): T | undefined {
  return (row as VirtualRow<T>).item
}
function chevron(row: unknown): string {
  return isCollapsed((row as VirtualRow<T>).groupKey!) ? '▶' : '▼'
}
function rowCssClass(row: unknown): string {
  return isHeaderRow(row) ? 'vvsk-grouped-row--header' : 'vvsk-grouped-row--item'
}
function rowAnimClass(row: unknown): string {
  const r = row as VirtualRow<T>
  if (r.type !== 'item' || !r.groupKey) return ''
  if (collapsingGroups.value.has(r.groupKey)) return 'vvsk-grouped-row--collapsing'
  if (expandingGroups.value.has(r.groupKey)) return 'vvsk-grouped-row--expanding'
  return ''
}

defineExpose({
  toggle,
  scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') =>
    listRef.value?.scrollTo(index, align),
})
</script>

<template>
  <VirtualList
    ref="listRef"
    :items="flatRows"
    key-field="_key"
    :estimated-item-size="estimatedItemSize"
    :overscan="overscan"
    @visible-range-change="$emit('visible-range-change', $event)"
    @scroll="$emit('scroll', $event)"
  >
    <template #default="{ item: row, index }">
      <div
        :key="getRowKey(asRow(row), index)"
        class="vvsk-grouped-row"
        :class="[rowCssClass(row), rowAnimClass(row)]"
      >
        <!-- Group header -->
        <template v-if="isHeaderRow(row)">
          <slot
            name="group-header"
            :group="rowGroup(row)"
            :toggle="() => toggle(rowGroupKey(row))"
            :is-collapsed="isCollapsed(rowGroupKey(row))"
          >
            <div
              class="vvsk-grouped-header-default"
              style="cursor: pointer; padding: 8px; font-weight: bold"
              @click="toggle(rowGroupKey(row))"
            >
              <span>{{ chevron(row) }}</span>
              {{ rowGroupLabel(row) }}
            </div>
          </slot>
        </template>

        <!-- Item -->
        <template v-else>
          <slot :item="rowItem(row)" :index="index" :group-key="rowGroupKey(row)" />
        </template>
      </div>
    </template>

    <template #empty>
      <slot name="empty" />
    </template>
  </VirtualList>
</template>

<style scoped>
@keyframes vvsk-collapse-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }

  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@keyframes vvsk-expand-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vvsk-grouped-row--collapsing {
  animation: vvsk-collapse-out 220ms ease forwards;
  pointer-events: none;
}

.vvsk-grouped-row--expanding {
  animation: vvsk-expand-in 220ms ease;
}
</style>
