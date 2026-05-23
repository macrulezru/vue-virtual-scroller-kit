<script setup lang="ts">
import { ref } from 'vue'
import VirtualTree from '../../../src/components/VirtualTree.vue'
import type { TreeNode } from '../../../src/components/VirtualTree.vue'

type FileNode = { label: string; type: 'file' | 'folder'; size?: number }

function makeTree(depth = 0, parentLabel = ''): TreeNode<FileNode>[] {
  const count = depth === 0 ? 8 : depth === 1 ? 5 : 3
  return Array.from({ length: count }, (_, i) => {
    const isFolder = depth < 2 || (depth === 2 && i % 3 === 0)
    const label = depth === 0
      ? ['src', 'tests', 'docs', 'dist', 'node_modules', 'public', 'scripts', 'config'][i]
      : `${isFolder ? 'folder' : 'file'}-${parentLabel}-${i}`
    const node: TreeNode<FileNode> = {
      id: `${parentLabel}-${label}`,
      data: { label, type: isFolder ? 'folder' : 'file', size: isFolder ? undefined : Math.round(Math.random() * 100) },
    }
    if (isFolder && depth < 3) {
      node.children = makeTree(depth + 1, label)
    }
    return node
  })
}

const treeRef = ref()
const nodes = ref<TreeNode<FileNode>[]>(makeTree())

// Simulate lazy-loading children for a special "lazy" root node
const lazyRoot: TreeNode<FileNode> = {
  id: 'lazy-root',
  data: { label: 'lazy-loaded (click to expand)', type: 'folder' },
  hasChildren: true,
}
nodes.value.push(lazyRoot)

async function loadChildren(node: TreeNode<FileNode>): Promise<TreeNode<FileNode>[]> {
  await new Promise((r) => setTimeout(r, 800))
  return Array.from({ length: 4 }, (_, i) => ({
    id: `${node.id}-child-${i}`,
    data: { label: `Dynamic child ${i + 1}`, type: 'file' as const, size: (i + 1) * 10 },
  }))
}

const clickedNode = ref<string | null>(null)
</script>

<template>
  <div class="demo-layout">
    <div class="demo-sidebar">
      <h2 class="demo-title">VirtualTree</h2>
      <p class="demo-description">
        Hierarchical tree with virtual scrolling and lazy-loaded children.
        Handles thousands of expanded nodes without DOM overhead.
      </p>

      <div class="demo-controls">
        <button class="demo-btn" @click="treeRef?.expandAll()">Expand All</button>
        <button class="demo-btn" @click="treeRef?.collapseAll()">Collapse All</button>
      </div>

      <div v-if="clickedNode" class="demo-info">
        <strong>Last clicked:</strong> {{ clickedNode }}
      </div>

      <div class="demo-features">
        <h4>Features</h4>
        <ul>
          <li>Virtualized rows (only visible nodes rendered)</li>
          <li>Lazy children loading with spinner</li>
          <li>Expand / Collapse all</li>
          <li>Custom node slot</li>
        </ul>
      </div>
    </div>

    <div class="demo-main">
      <div class="demo-panel" style="height: 100%">
        <VirtualTree
          ref="treeRef"
          :nodes="nodes"
          :indent="18"
          :estimated-item-size="36"
          :on-load-children="loadChildren"
          style="height: 100%; background: var(--color-surface-2); border-radius: 8px;"
          @node-click="(n) => (clickedNode = String(n.data.label))"
        >
          <template #default="{ row }">
            <span class="tree-icon">{{ row.node.data.type === 'folder' ? (row.isExpanded ? '📂' : '📁') : '📄' }}</span>
            <span class="tree-label">{{ row.node.data.label }}</span>
            <span v-if="row.node.data.size != null" class="tree-size">{{ row.node.data.size }} KB</span>
          </template>
        </VirtualTree>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-layout {
  display: flex;
  height: 100%;
  gap: 0;
  overflow: hidden;
}

.demo-sidebar {
  width: 260px;
  flex-shrink: 0;
  padding: 20px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.demo-main {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.demo-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
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

.demo-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.demo-info {
  font-size: 12px;
  padding: 8px 10px;
  background: var(--color-surface-2);
  border-radius: 6px;
}

.demo-features ul {
  margin: 4px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.8;
}

.demo-features h4 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.tree-icon { font-size: 14px; flex-shrink: 0; }
.tree-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.tree-size { font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; }
</style>
