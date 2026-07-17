import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface UseRowSelectionOptions<T> {
  /** Reactive source array — selection keys are derived from these items. */
  items: Ref<T[]> | ComputedRef<T[]>
  /** Returns the stable identity for an item. Defaults to `(item as any).id ?? index`. */
  getKey?: (item: T, index: number) => string | number
  /** Allow more than one selected key (shift-range, ctrl/cmd-toggle). Default true. */
  multiple?: boolean
}

export interface UseRowSelectionReturn<T> {
  selectedKeys: Readonly<Ref<Set<string | number>>>
  selectedItems: ComputedRef<T[]>
  isSelected: (item: T, index: number) => boolean
  /**
   * Toggle an item's selection. With `multiple` on: a plain call (or click without
   * modifiers) selects just this item; `event.shiftKey` selects the range from the last
   * toggled index to this one; `event.ctrlKey`/`event.metaKey` adds/removes this item
   * without touching the rest — the same conventions as native OS multi-select.
   */
  toggle: (item: T, index: number, event?: MouseEvent | KeyboardEvent) => void
  selectAll: () => void
  clearSelection: () => void
}

export function useRowSelection<T>(options: UseRowSelectionOptions<T>): UseRowSelectionReturn<T> {
  const { items, multiple = true } = options
  const getKey =
    options.getKey ??
    ((item: T, index: number): string | number => {
      const withId = item as unknown as { id?: string | number }
      return withId?.id ?? index
    })

  const selectedKeys = ref<Set<string | number>>(new Set())
  let lastToggledIndex: number | null = null

  const selectedItems = computed(() =>
    items.value.filter((item, index) => selectedKeys.value.has(getKey(item, index))),
  )

  function isSelected(item: T, index: number): boolean {
    return selectedKeys.value.has(getKey(item, index))
  }

  function toggle(item: T, index: number, event?: MouseEvent | KeyboardEvent): void {
    const key = getKey(item, index)

    // Shift-click/keypress: fill the range from the last-toggled index to this one as
    // selected, on top of whatever else is already selected — the same convention as
    // checking a checkbox, scrolling, then shift-clicking a later one (Gmail-style).
    if (multiple && event?.shiftKey && lastToggledIndex !== null) {
      const [from, to] =
        lastToggledIndex < index ? [lastToggledIndex, index] : [index, lastToggledIndex]
      const next = new Set(selectedKeys.value)
      for (let i = from; i <= to && i < items.value.length; i++) {
        next.add(getKey(items.value[i], i))
      }
      selectedKeys.value = next
      lastToggledIndex = index
      return
    }

    // Everything else (plain click, ctrl/cmd-click, a bare checkbox toggle with no event)
    // just flips this one item's membership. In single-select mode (`multiple: false`)
    // it replaces the selection instead, since there's nothing else to preserve.
    const next = multiple ? new Set(selectedKeys.value) : new Set<string | number>()
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedKeys.value = next
    lastToggledIndex = index
  }

  function selectAll(): void {
    selectedKeys.value = new Set(items.value.map((item, index) => getKey(item, index)))
  }

  function clearSelection(): void {
    selectedKeys.value = new Set()
    lastToggledIndex = null
  }

  return {
    selectedKeys: selectedKeys as Readonly<Ref<Set<string | number>>>,
    selectedItems,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
  }
}
