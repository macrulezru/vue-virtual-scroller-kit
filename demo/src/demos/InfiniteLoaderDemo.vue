<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { InfiniteLoader } from 'vue-virtual-scroller-kit'

/* ── Types ─────────────────────────────────────────────────── */
interface Post {
  id: number
  title: string
  body: string
  author: string
  ts: string
  likes: number
  replies: number
  tag: string
}

/* ── Fake API ──────────────────────────────────────────────── */
const TAGS = ['Discussion', 'Announcement', 'Question', 'Tutorial', 'Showcase', 'Meta']
const AUTHORS = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank']
const LATENCY_OPTIONS = [200, 800, 2000]
const BODIES = [
  'Has anyone found a good pattern for this? I\'ve been struggling with edge cases for a while.',
  'Just shipped v2.0! Includes a full rewrite of the core engine and 40% smaller bundle.',
  'Quick question: is it possible to override the default behavior without a plugin?',
  'Step-by-step guide to integrating this with Nuxt 4 and server components.',
  'Built a small demo to show what\'s possible with the new composable API.',
  'Heads up: the previous approach is deprecated as of 0.9. See migration guide below.',
]

let nextId = 1
let latency = ref(LATENCY_OPTIONS[0])
let serverPageSize = 25

function fakeFetch(direction: 'down' | 'up' = 'down'): Promise<Post[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const batch: Post[] = Array.from({ length: serverPageSize }, (_, i) => {
        const id = direction === 'down' ? nextId++ : --nextId
        return {
          id,
          title: `Post #${Math.abs(id)} — ${TAGS[Math.abs(id) % TAGS.length]}`,
          body: BODIES[Math.abs(id) % BODIES.length],
          author: AUTHORS[Math.abs(id) % AUTHORS.length],
          ts: new Date(Date.now() - Math.abs(id) * 120_000).toLocaleTimeString(),
          likes: Math.floor(Math.random() * 200),
          replies: Math.floor(Math.random() * 50),
          tag: TAGS[Math.abs(id) % TAGS.length],
        }
      })
      resolve(batch)
    }, latency.value)
  })
}

/* ── State ─────────────────────────────────────────────────── */
const items = shallowRef<Post[]>([])
const isLoading = ref(false)
const hasMore = ref(true)
const direction = ref<'down' | 'up' | 'both'>('down')
const loadCount = ref(0)
const maxItems = ref(500)
const visibleInfo = ref({ start: 0, end: 0 })

// Initialize with first page
;(async () => {
  isLoading.value = true
  items.value = await fakeFetch('down')
  isLoading.value = false
})()

async function loadMore() {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true
  try {
    const batch = await fakeFetch(direction.value === 'up' ? 'up' : 'down')
    if (direction.value === 'up') {
      items.value = [...batch.reverse(), ...items.value]
    } else {
      items.value = [...items.value, ...batch]
    }
    loadCount.value++
    if (items.value.length >= maxItems.value) hasMore.value = false
  } finally {
    isLoading.value = false
  }
}

function reset() {
  nextId = 1
  items.value = []
  hasMore.value = true
  loadCount.value = 0
  isLoading.value = true
  fakeFetch('down').then((batch) => {
    items.value = batch
    isLoading.value = false
  })
}

const TAG_COLOR: Record<string, string> = {
  Discussion: 'blue', Announcement: 'green', Question: 'yellow',
  Tutorial: 'purple', Showcase: 'purple', Meta: 'red',
}
</script>

<template>
  <div class="demo">
    <aside class="demo-sidebar">
      <h2 class="demo-sidebar__title">InfiniteLoader</h2>
      <p class="demo-sidebar__desc">
        Wraps <code>VirtualList</code> with automatic load-more triggering.
        Debounce 50 ms. Up-direction restores scroll position after prepend.
      </p>

      <div class="demo-sidebar__stats">
        <div class="demo-stat">
          <strong>{{ items.length }}</strong> / {{ maxItems }} loaded
        </div>
        <div class="demo-stat">
          <strong>{{ loadCount }}</strong> API calls
        </div>
        <div class="demo-stat">
          Visible <strong>{{ visibleInfo.end - visibleInfo.start + 1 }}</strong>
        </div>
      </div>

      <!-- Direction -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Direction</label>
        <div class="demo-sidebar__row">
          <button
            v-for="d in ['down', 'up', 'both']"
            :key="d"
            class="demo-btn"
            :class="{ 'demo-btn--primary': direction === d }"
            @click="() => { direction = d as typeof direction; reset() }"
          >{{ d }}</button>
        </div>
      </div>

      <!-- Simulated latency -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Simulated API latency</label>
        <div class="demo-sidebar__row">
          <button
            v-for="ms in LATENCY_OPTIONS"
            :key="ms"
            class="demo-btn"
            :class="{ 'demo-btn--primary': latency === ms }"
            @click="latency = ms"
          >{{ ms }}ms</button>
        </div>
      </div>

      <!-- Max items -->
      <div class="demo-sidebar__group">
        <label class="demo-sidebar__label">Max items: {{ maxItems }}</label>
        <input v-model.number="maxItems" type="range" min="50" max="2000" step="50" class="demo-range" @change="reset" />
      </div>

      <button class="demo-btn demo-btn--primary" @click="reset">↺ Reset</button>

      <div class="demo-code">&lt;InfiniteLoader
  :items="items"
  :on-load-more="loadMore"
  :is-loading="{{ isLoading }}"
  :has-more="{{ hasMore }}"
  direction="{{ direction }}"
  :threshold="200"
&gt;
  &lt;template #default="{ item, index, style }"&gt;
    &lt;!-- post row --&gt;
  &lt;/template&gt;
  &lt;template #loading-indicator&gt;
    &lt;!-- spinner --&gt;
  &lt;/template&gt;
&lt;/InfiniteLoader&gt;</div>

      <div v-if="!hasMore" class="demo-badge demo-badge--green" style="align-self:flex-start">
        ✓ All {{ maxItems }} items loaded
      </div>
    </aside>

    <div class="demo-viewport">
      <InfiniteLoader
        :items="items"
        :on-load-more="loadMore"
        :is-loading="isLoading"
        :has-more="hasMore"
        :direction="direction"
        :threshold="200"
        :estimated-item-size="130"
        key-field="id"
        style="height: 100%;"
        @visible-range-change="visibleInfo = $event"
      >
        <template #default="{ item, index }">
          <div class="post-row" :class="{ 'post-row--alt': index % 2 === 1 }">
            <div class="post-row__header">
              <div class="post-row__avatar">{{ (item as Post).author[0].toUpperCase() }}</div>
              <div>
                <div class="post-row__author">@{{ (item as Post).author }}</div>
                <div class="post-row__time">{{ (item as Post).ts }}</div>
              </div>
              <span :class="`demo-badge demo-badge--${TAG_COLOR[(item as Post).tag]}`">
                {{ (item as Post).tag }}
              </span>
            </div>
            <div class="post-row__title">{{ (item as Post).title }}</div>
            <div class="post-row__body">{{ (item as Post).body }}</div>
            <div class="post-row__meta">
              <span>❤️ {{ (item as Post).likes }}</span>
              <span>💬 {{ (item as Post).replies }}</span>
            </div>
          </div>
        </template>

        <template #loading-indicator>
          <div class="loader-indicator">
            <span class="loader-indicator__spinner" />
            Loading more posts…
          </div>
        </template>
      </InfiniteLoader>
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
.demo-range { width: 100%; accent-color: var(--color-primary); }

.demo-viewport { flex: 1; overflow: hidden; background: var(--color-bg); }

/* Post row */
.post-row {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex; flex-direction: column; gap: 6px;
}
.post-row--alt { background: var(--color-surface); }
.post-row__header {
  display: flex; align-items: center; gap: 10px;
}
.post-row__avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--color-primary-dim);
  color: var(--color-primary);
  font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.post-row__author { font-size: 13px; font-weight: 600; }
.post-row__time   { font-size: 11px; color: var(--color-text-muted); }
.post-row__title  { font-size: 14px; font-weight: 600; }
.post-row__body   { font-size: 13px; color: var(--color-text-muted); line-height: 1.5; }
.post-row__meta   { display: flex; gap: 16px; font-size: 12px; color: var(--color-text-muted); }

/* Loading indicator */
.loader-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}
.loader-indicator__spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin .6s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
