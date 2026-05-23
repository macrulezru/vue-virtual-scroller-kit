<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, shallowRef } from 'vue'
import VirtualList from './VirtualList.vue'
import type { VirtualListExpose } from '../types'

export interface TreeNode<N extends Record<string, unknown> = Record<string, unknown>> {
  id: string | number
  data: N
  children?: TreeNode<N>[]
  /** If true, node can have children that haven't been loaded yet */
  hasChildren?: boolean
}

export interface FlatTreeRow<N extends Record<string, unknown> = Record<string, unknown>> {
  node: TreeNode<N>
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  isLoading: boolean
}

const props = withDefaults(
  defineProps<{
    nodes: TreeNode<T>[]
    /** indent per depth level in pixels */
    indent?: number
    estimatedItemSize?: number
    overscan?: number
    /** Called when a collapsed node with hasChildren=true needs children loaded */
    onLoadChildren?: (node: TreeNode<T>) => Promise<TreeNode<T>[]>
  }>(),
  {
    indent: 20,
    estimatedItemSize: 36,
    overscan: 5,
  },
)

const emit = defineEmits<{
  'node-expand': [node: TreeNode<T>]
  'node-collapse': [node: TreeNode<T>]
  'node-click': [node: TreeNode<T>, depth: number]
}>()

const listRef = ref<VirtualListExpose | null>(null)
const expandedIds = ref<Set<string | number>>(new Set())
const loadingIds = ref<Set<string | number>>(new Set())
const lazyChildren = shallowRef<Map<string | number, TreeNode<T>[]>>(new Map())

function flattenNodes(nodes: TreeNode<T>[], depth = 0): FlatTreeRow<T>[] {
  const rows: FlatTreeRow<T>[] = []
  for (const node of nodes) {
    const isExpanded = expandedIds.value.has(node.id)
    const lazy = lazyChildren.value.get(node.id)
    const children = lazy ?? node.children
    const hasKids = !!children?.length || !!node.hasChildren
    rows.push({
      node,
      depth,
      isExpanded,
      hasChildren: hasKids,
      isLoading: loadingIds.value.has(node.id),
    })
    if (isExpanded && children?.length) {
      rows.push(...flattenNodes(children as TreeNode<T>[], depth + 1))
    }
  }
  return rows
}

const flatRows = computed(() => flattenNodes(props.nodes))

async function toggle(row: FlatTreeRow<T>): Promise<void> {
  const { node } = row
  if (expandedIds.value.has(node.id)) {
    expandedIds.value = new Set([...expandedIds.value].filter((id) => id !== node.id))
    emit('node-collapse', node)
    return
  }

  // Lazy load children
  if (node.hasChildren && !lazyChildren.value.has(node.id) && props.onLoadChildren) {
    loadingIds.value = new Set([...loadingIds.value, node.id])
    try {
      const children = await props.onLoadChildren(node)
      lazyChildren.value = new Map(lazyChildren.value).set(node.id, children)
    } finally {
      loadingIds.value = new Set([...loadingIds.value].filter((id) => id !== node.id))
    }
  }

  expandedIds.value = new Set([...expandedIds.value, node.id])
  emit('node-expand', node)
}

function expandAll(nodes: TreeNode<T>[] = props.nodes): void {
  const ids = new Set(expandedIds.value)
  function collect(ns: TreeNode<T>[]): void {
    for (const n of ns) {
      ids.add(n.id)
      if (n.children?.length) collect(n.children as TreeNode<T>[])
    }
  }
  collect(nodes)
  expandedIds.value = ids
}

function collapseAll(): void {
  expandedIds.value = new Set()
}

defineExpose({
  scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') =>
    listRef.value?.scrollTo(index, align),
  expandAll,
  collapseAll,
  expandedIds: expandedIds as Readonly<typeof expandedIds>,
})

function isRow(val: unknown): val is FlatTreeRow<T> {
  return val != null && typeof val === 'object' && 'node' in (val as object)
}

function asRow(val: unknown): FlatTreeRow<T> {
  return val as FlatTreeRow<T>
}
</script>

<template>
  <VirtualList
    ref="listRef"
    :items="flatRows"
    key-field="node.id"
    :estimated-item-size="estimatedItemSize"
    :overscan="overscan"
  >
    <template #default="{ item, index }">
      <div
        v-if="isRow(item)"
        class="vvsk-tree__row"
        :style="{ paddingLeft: `${asRow(item).depth * indent}px` }"
        role="treeitem"
        :aria-expanded="asRow(item).hasChildren ? asRow(item).isExpanded : undefined"
        :aria-level="asRow(item).depth + 1"
        :aria-rowindex="index + 1"
        @click="$emit('node-click', asRow(item).node, asRow(item).depth)"
      >
        <button
          v-if="asRow(item).hasChildren || asRow(item).isLoading"
          class="vvsk-tree__toggle"
          :aria-label="asRow(item).isExpanded ? 'Collapse' : 'Expand'"
          @click.stop="toggle(asRow(item))"
        >
          <span v-if="asRow(item).isLoading" class="vvsk-tree__spinner" />
          <span v-else>{{ asRow(item).isExpanded ? '▾' : '▸' }}</span>
        </button>
        <span v-else class="vvsk-tree__leaf-spacer" />

        <slot :row="asRow(item)" :index="index">
          <span class="vvsk-tree__label">{{
            asRow(item).node.data['label'] ?? asRow(item).node.id
          }}</span>
        </slot>
      </div>
    </template>

    <template #empty>
      <slot name="empty"><div class="vvsk-tree__empty">No items</div></slot>
    </template>
  </VirtualList>
</template>

<style scoped>
.vvsk-tree__row {
  display: flex;
  align-items: center;
  min-height: 36px;
  cursor: pointer;
  gap: 4px;
}

.vvsk-tree__row:hover {
  background: rgb(255, 255, 255, 0.05);
}

.vvsk-tree__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-size: 0.85em;
  padding: 0;
  border-radius: 3px;
}

.vvsk-tree__toggle:hover {
  background: rgb(255, 255, 255, 0.1);
}

.vvsk-tree__leaf-spacer {
  width: 20px;
  flex-shrink: 0;
}

.vvsk-tree__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vvsk-tree__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentcolor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: vvsk-spin 0.6s linear infinite;
  display: inline-block;
}

@keyframes vvsk-spin {
  to {
    transform: rotate(360deg);
  }
}

.vvsk-tree__empty {
  padding: 16px;
  text-align: center;
  opacity: 0.5;
}
</style>
