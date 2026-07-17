<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import VirtualList from './VirtualList.vue'
import type { VirtualListExpose } from '../types'

const props = withDefaults(
  defineProps<{
    options: T[]
    modelValue?: T | null
    /** Field used for display text */
    labelField?: string
    /** Field used for value comparison */
    valueField?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    estimatedItemSize?: number
    /** Max visible rows in dropdown */
    maxVisibleRows?: number
    /** Allow typing to filter options */
    searchable?: boolean
    /** Apply a CSS blur while scrolling fast, clearing once scrolling settles. Off by default. */
    motionBlur?: boolean
    /**
     * Skip client-side filtering — `options` is assumed already filtered by the consumer
     * (e.g. from a server response driven by the `search` event). Off by default.
     */
    remote?: boolean
    /** Shows the #loading slot in the dropdown instead of options/empty. Off by default. */
    isLoading?: boolean
    /**
     * Delay in ms before the `search` event fires after a keystroke. The input's own
     * displayed value always updates instantly — only the emitted event is delayed.
     * Default `0` (fires synchronously, matching prior versions); set e.g. `300` for
     * `remote` search to avoid firing a request on every keystroke.
     */
    debounceMs?: number
  }>(),
  {
    modelValue: null,
    labelField: 'label',
    valueField: 'value',
    placeholder: 'Select an option…',
    disabled: false,
    clearable: false,
    estimatedItemSize: 36,
    maxVisibleRows: 8,
    searchable: true,
    motionBlur: false,
    remote: false,
    isLoading: false,
    debounceMs: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: T | null]
  change: [value: T | null]
  search: [query: string]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const listRef = ref<VirtualListExpose | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const highlightedIndex = ref(-1)

function getLabel(item: T): string {
  return String(item[props.labelField] ?? '')
}

function getValue(item: T): unknown {
  return item[props.valueField]
}

const filteredOptions = computed(() => {
  if (props.remote) return props.options
  if (!props.searchable || !searchQuery.value.trim()) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter((o) => getLabel(o).toLowerCase().includes(q))
})

const dropdownHeight = computed(() => {
  const rows = Math.min(props.maxVisibleRows, filteredOptions.value.length)
  return rows * props.estimatedItemSize
})

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  return getLabel(props.modelValue)
})

function selectOption(option: T): void {
  emit('update:modelValue', option)
  emit('change', option)
  close()
}

function clear(e: MouseEvent): void {
  e.stopPropagation()
  emit('update:modelValue', null)
  emit('change', null)
}

function open(): void {
  if (props.disabled) return
  isOpen.value = true
  searchQuery.value = ''
  highlightedIndex.value = -1
  nextTick(() => {
    inputRef.value?.focus()
    // Scroll to selected item
    if (props.modelValue) {
      const idx = filteredOptions.value.findIndex(
        (o) => getValue(o) === getValue(props.modelValue!),
      )
      if (idx >= 0) {
        highlightedIndex.value = idx
        listRef.value?.scrollTo(idx, 'auto')
      }
    }
  })
}

function close(): void {
  isOpen.value = false
  searchQuery.value = ''
}

function toggle(): void {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput(e: Event): void {
  searchQuery.value = (e.target as HTMLInputElement).value
  highlightedIndex.value = -1
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer)
  if (props.debounceMs > 0) {
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null
      emit('search', searchQuery.value)
    }, props.debounceMs)
  } else {
    emit('search', searchQuery.value)
  }
}

onUnmounted(() => {
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer)
})

function onKeyDown(e: KeyboardEvent): void {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') open()
    return
  }
  const count = filteredOptions.value.length
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      highlightedIndex.value = Math.min(count - 1, highlightedIndex.value + 1)
      listRef.value?.scrollTo(highlightedIndex.value, 'auto')
      break
    case 'ArrowUp':
      e.preventDefault()
      highlightedIndex.value = Math.max(0, highlightedIndex.value - 1)
      listRef.value?.scrollTo(highlightedIndex.value, 'auto')
      break
    case 'Enter':
      e.preventDefault()
      if (highlightedIndex.value >= 0) {
        selectOption(filteredOptions.value[highlightedIndex.value])
      }
      break
    case 'Escape':
      close()
      break
    case 'Tab':
      close()
      break
  }
}

function onClickOutside(e: MouseEvent): void {
  if (!rootRef.value?.contains(e.target as Node)) close()
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('mousedown', onClickOutside)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

function isSelected(option: T): boolean {
  if (!props.modelValue) return false
  return getValue(option) === getValue(props.modelValue)
}

function isHighlighted(index: number): boolean {
  return highlightedIndex.value === index
}

defineExpose({ open, close, getScrollElement: () => listRef.value?.getScrollElement() ?? null })
</script>

<template>
  <div
    ref="rootRef"
    class="vvsk-select"
    :class="{
      'vvsk-select--open': isOpen,
      'vvsk-select--disabled': disabled,
      'vvsk-select--has-value': !!modelValue,
    }"
    role="combobox"
    :aria-expanded="isOpen"
    :aria-haspopup="'listbox'"
    :aria-disabled="disabled"
    @keydown="onKeyDown"
  >
    <!-- Trigger -->
    <div class="vvsk-select__trigger" tabindex="0" @click="toggle" @keydown.stop>
      <span v-if="!isOpen || !searchable" class="vvsk-select__value">
        {{ selectedLabel || placeholder }}
      </span>
      <input
        v-if="isOpen && searchable"
        ref="inputRef"
        class="vvsk-select__search"
        :value="searchQuery"
        :placeholder="selectedLabel || placeholder"
        @input="onSearchInput"
        @keydown="onKeyDown"
        @click.stop
      />
      <button
        v-if="clearable && modelValue"
        class="vvsk-select__clear"
        aria-label="Clear"
        @click="clear"
      >
        ✕
      </button>
      <span class="vvsk-select__arrow" :class="{ 'vvsk-select__arrow--open': isOpen }">▾</span>
    </div>

    <!-- Dropdown -->
    <div v-if="isOpen" class="vvsk-select__dropdown" role="listbox">
      <div v-if="isLoading" class="vvsk-select__loading" aria-live="polite">
        <slot name="loading">Loading…</slot>
      </div>
      <div v-else-if="filteredOptions.length === 0" class="vvsk-select__empty">
        <slot name="empty">No options</slot>
      </div>
      <VirtualList
        v-else
        ref="listRef"
        :items="filteredOptions"
        :value-field="valueField"
        :estimated-item-size="estimatedItemSize"
        :style="{ height: `${dropdownHeight}px` }"
        :min-height="estimatedItemSize"
        :motion-blur="motionBlur"
      >
        <template #default="{ item, index }">
          <div
            class="vvsk-select__option"
            :class="{
              'vvsk-select__option--selected': isSelected(item as T),
              'vvsk-select__option--highlighted': isHighlighted(index),
            }"
            role="option"
            :aria-selected="isSelected(item as T)"
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent="selectOption(item as T)"
          >
            <slot :option="item as T" :index="index" :selected="isSelected(item as T)">
              {{ getLabel(item as T) }}
            </slot>
          </div>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<style scoped>
.vvsk-select {
  position: relative;
  display: inline-block;
  width: 100%;
  font-size: 14px;
}

.vvsk-select__trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--vvsk-select-border, #3a3d52);
  border-radius: 6px;
  background: var(--vvsk-select-bg, #1a1b2e);
  cursor: pointer;
  min-height: 38px;
  outline: none;
}

.vvsk-select__trigger:focus {
  border-color: var(--vvsk-select-focus, #6366f1);
  box-shadow: 0 0 0 2px rgb(99, 102, 241, 0.3);
}

.vvsk-select--disabled .vvsk-select__trigger {
  opacity: 0.5;
  cursor: not-allowed;
}

.vvsk-select__value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vvsk-select-placeholder, #888);
}

.vvsk-select--has-value .vvsk-select__value {
  color: inherit;
}

.vvsk-select__search {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: inherit;
  font-size: inherit;
  min-width: 0;
}

.vvsk-select__clear {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.5;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
}

.vvsk-select__clear:hover {
  opacity: 1;
}

.vvsk-select__arrow {
  opacity: 0.5;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.vvsk-select__arrow--open {
  transform: rotate(180deg);
}

.vvsk-select__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 100;
  border: 1px solid var(--vvsk-select-border, #3a3d52);
  border-radius: 6px;
  background: var(--vvsk-select-dropdown-bg, #1e2035);
  box-shadow: 0 8px 24px rgb(0, 0, 0, 0.4);
  overflow: hidden;
}

.vvsk-select__option {
  padding: 8px 12px;
  cursor: pointer;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.vvsk-select__option--highlighted {
  background: var(--vvsk-select-highlight, rgb(99, 102, 241, 0.2));
}

.vvsk-select__option--selected {
  background: var(--vvsk-select-selected, rgb(99, 102, 241, 0.35));
  font-weight: 600;
}

.vvsk-select__empty {
  padding: 12px;
  text-align: center;
  opacity: 0.5;
}

.vvsk-select__loading {
  padding: 12px;
  text-align: center;
  opacity: 0.5;
}
</style>
