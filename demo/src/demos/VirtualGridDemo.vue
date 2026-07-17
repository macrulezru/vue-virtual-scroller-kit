<script setup lang="ts">
import { ref, computed } from 'vue'
import VirtualGrid from '../../../src/components/VirtualGrid.vue'

interface Photo {
  id: number
  color: string
  label: string
  aspect: number
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#14b8a6',
]

const photos = Array.from({ length: 2000 }, (_, i) => ({
  id: i,
  color: COLORS[i % COLORS.length],
  label: `Image #${i + 1}`,
  // Sparse and scattered (not aligned to any small column count) so most rows stay
  // short and only occasionally contain a tall item — a clearer dynamic-height demo
  // than "every row hits the tallest aspect" would be.
  aspect: (i * 37) % 11 === 0 ? 1.8 : 1,
}))

const columnCount = ref(0) // 0 = auto
const cellWidth = ref(180)
const cellHeight = ref(160)
const gap = ref(12)
const isLoading = ref(false)
const dynamicRowHeight = ref(false)
const gridRef = ref()

function toggleLoading() {
  isLoading.value = !isLoading.value
}

const displayedPhotos = computed(() => isLoading.value ? [] : photos)
</script>

<template>
  <div class="demo-layout">
    <div class="demo-sidebar">
      <h2 class="demo-title">VirtualGrid</h2>
      <p class="demo-description">
        Fixed-cell 2-D grid with virtual row scrolling. Renders only visible rows,
        perfect for photo galleries and dashboards.
      </p>

      <div class="demo-controls">
        <label class="demo-label">
          Columns (0 = auto)
          <input v-model.number="columnCount" type="range" min="0" max="6" step="1" />
          <span>{{ columnCount || 'auto' }}</span>
        </label>
        <label class="demo-label">
          Cell width
          <input v-model.number="cellWidth" type="range" min="100" max="400" step="10" />
          <span>{{ cellWidth }}px</span>
        </label>
        <label class="demo-label">
          Cell height
          <input v-model.number="cellHeight" type="range" min="80" max="400" step="10" />
          <span>{{ cellHeight }}px</span>
        </label>
        <label class="demo-label">
          Gap
          <input v-model.number="gap" type="range" min="0" max="32" />
          <span>{{ gap }}px</span>
        </label>
      </div>

      <div class="demo-controls">
        <button class="demo-btn" @click="toggleLoading">
          {{ isLoading ? 'Show Items' : 'Show Skeleton' }}
        </button>
        <button class="demo-btn" @click="gridRef?.scrollTo(500)">Jump to #500</button>
      </div>

      <label class="demo-checkbox">
        <input v-model="dynamicRowHeight" type="checkbox" />
        Dynamic row height (measured per row)
      </label>

      <div class="demo-info">
        <strong>{{ photos.length.toLocaleString() }}</strong> items total
      </div>
    </div>

    <div class="demo-main">
      <VirtualGrid
        ref="gridRef"
        :items="displayedPhotos"
        :columns="columnCount"
        :column-width="cellWidth"
        :row-height="cellHeight"
        :gap="gap"
        :is-loading="isLoading"
        :dynamic-row-height="dynamicRowHeight"
        style="height: 100%; border: 1px solid var(--color-border); border-radius: 8px"
      >
        <template #default="{ item, index }">
          <div
            class="grid-cell"
            :style="{
              background: (item as Photo).color,
              height: dynamicRowHeight ? `${cellHeight * (item as Photo).aspect}px` : '100%',
            }"
          >
            <span class="grid-cell__label">{{ (item as Photo).label }}</span>
            <span class="grid-cell__index">#{{ index }}</span>
          </div>
        </template>
      </VirtualGrid>
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
  flex-direction: column;
  gap: 10px;
}

.demo-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.demo-label input[type='range'] { width: 100%; }
.demo-label span { font-size: 11px; font-weight: 600; color: var(--color-primary); }

.demo-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.demo-info {
  font-size: 12px;
  padding: 8px 10px;
  background: var(--color-surface-2);
  border-radius: 6px;
}

.grid-cell {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: transform 0.1s, filter 0.1s;
}

.grid-cell:hover {
  transform: scale(0.97);
  filter: brightness(1.15);
}

.grid-cell__label { font-weight: 600; }
.grid-cell__index { opacity: 0.7; font-size: 10px; }
</style>
