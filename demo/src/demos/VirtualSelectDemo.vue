<script setup lang="ts">
import { ref, computed } from 'vue'
import VirtualSelect from '../../../src/components/VirtualSelect.vue'

interface Country {
  code: string
  name: string
  population: number
  continent: string
}

const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania']

// Generate 10k+ synthetic options
const allCountries: Country[] = Array.from({ length: 10000 }, (_, i) => ({
  code: `C${String(i).padStart(4, '0')}`,
  name: `Country ${i + 1} (${CONTINENTS[i % 6]})`,
  population: Math.round(Math.random() * 100_000_000),
  continent: CONTINENTS[i % 6],
}))

const selected1 = ref<Country | null>(null)
const selected2 = ref<Country | null>(null)
const selected3 = ref<Country | null>(null)
const selected4 = ref<Country | null>(null)

/* ── Remote/async search — simulates a debounced server round-trip ─────────── */
const remoteOptions = ref<Country[]>(allCountries.slice(0, 20))
const remoteLoading = ref(false)
let remoteRequestId = 0

function onRemoteSearch(query: string) {
  remoteLoading.value = true
  const requestId = ++remoteRequestId
  setTimeout(() => {
    if (requestId !== remoteRequestId) return // a newer search superseded this one
    const q = query.trim().toLowerCase()
    remoteOptions.value = q
      ? allCountries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50)
      : allCountries.slice(0, 20)
    remoteLoading.value = false
  }, 500) // simulated network latency
}

const filterContinent = ref('')
const filteredOptions = computed(() =>
  filterContinent.value
    ? allCountries.filter((c) => c.continent === filterContinent.value)
    : allCountries,
)

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
</script>

<template>
  <div class="demo-layout">
    <div class="demo-sidebar">
      <h2 class="demo-title">VirtualSelect</h2>
      <p class="demo-description">
        Virtualized dropdown for large option lists. Supports search/filter,
        custom option slots, and keyboard navigation.
      </p>

      <div class="demo-info">
        <strong>{{ allCountries.length.toLocaleString() }}</strong> total options
      </div>

      <div class="demo-features">
        <h4>Features</h4>
        <ul>
          <li>Virtual scrolling inside dropdown</li>
          <li>Type-to-filter search</li>
          <li>Keyboard navigation (↑↓ Enter Esc)</li>
          <li>Clearable selection</li>
          <li>Custom option slot</li>
          <li>Remote/async search with debounce + loading state</li>
        </ul>
      </div>
    </div>

    <div class="demo-main">
      <div class="demo-selects">
        <section class="demo-section">
          <h3>Basic select (10k options)</h3>
          <VirtualSelect
            v-model="selected1"
            :options="allCountries"
            label-field="name"
            value-field="code"
            placeholder="Search or select a country…"
            :clearable="true"
            style="max-width: 420px"
          />
          <p v-if="selected1" class="demo-selection">
            Selected: <strong>{{ selected1.name }}</strong>
            ({{ selected1.continent }}, pop. {{ formatPop(selected1.population) }})
          </p>
        </section>

        <section class="demo-section">
          <h3>Filtered by continent</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px">
            <button
              v-for="c in ['', ...CONTINENTS]"
              :key="c"
              class="demo-btn"
              :class="{ 'demo-btn--active': filterContinent === c }"
              style="font-size: 11px; padding: 4px 10px"
              @click="filterContinent = c; selected2 = null"
            >
              {{ c || 'All' }}
            </button>
          </div>
          <VirtualSelect
            v-model="selected2"
            :options="filteredOptions"
            label-field="name"
            value-field="code"
            :placeholder="`${filteredOptions.length.toLocaleString()} options…`"
            style="max-width: 420px"
          />
        </section>

        <section class="demo-section">
          <h3>Custom option slot</h3>
          <VirtualSelect
            v-model="selected3"
            :options="allCountries"
            label-field="name"
            value-field="code"
            placeholder="Pick a country…"
            :estimated-item-size="44"
            :max-visible-rows="6"
            style="max-width: 420px"
          >
            <template #default="{ option, selected }">
              <div class="custom-option" :class="{ 'custom-option--selected': selected }">
                <span class="custom-option__flag">🌐</span>
                <div class="custom-option__info">
                  <span class="custom-option__name">{{ (option as Country).name }}</span>
                  <span class="custom-option__sub">
                    {{ (option as Country).continent }} · {{ formatPop((option as Country).population) }}
                  </span>
                </div>
                <span v-if="selected" class="custom-option__check">✓</span>
              </div>
            </template>
          </VirtualSelect>
        </section>

        <section class="demo-section">
          <h3>Remote search (simulated server, 500ms latency)</h3>
          <p class="demo-selection" style="margin: 0 0 12px">
            Options start as a small "first page"; typing debounces 300ms then fetches
            (simulated) matching results and shows a loading state meanwhile.
          </p>
          <VirtualSelect
            v-model="selected4"
            :options="remoteOptions"
            label-field="name"
            value-field="code"
            placeholder="Type to search remotely…"
            remote
            :debounce-ms="300"
            :is-loading="remoteLoading"
            style="max-width: 420px"
            @search="onRemoteSearch"
          >
            <template #loading>
              <div style="padding: 4px 0">⏳ Searching…</div>
            </template>
          </VirtualSelect>
        </section>
      </div>
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
  width: 240px;
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
  overflow-y: auto;
}

.demo-selects {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 600px;
}

.demo-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--color-text-muted);
}

.demo-selection {
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-muted);
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

.demo-btn--active {
  background: var(--color-primary) !important;
  color: white !important;
}

.custom-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  min-height: 44px;
  width: 100%;
}

.custom-option__flag { font-size: 18px; flex-shrink: 0; }
.custom-option__info { flex: 1; min-width: 0; }
.custom-option__name { font-size: 13px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.custom-option__sub { font-size: 11px; color: var(--color-text-muted); display: block; }
.custom-option__check { color: var(--color-primary); font-weight: 700; }
</style>
