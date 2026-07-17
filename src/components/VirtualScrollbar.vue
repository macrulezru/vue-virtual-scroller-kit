<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { normalizeScrollLeft, setNormalizedScrollLeft } from '../utils/normalizeScrollLeft'

const props = withDefaults(
  defineProps<{
    /** Returns the scrollable element to sync with (e.g. `() => listRef.value?.getScrollElement() ?? null`). */
    target: () => HTMLElement | null
    orientation?: 'vertical' | 'horizontal'
    /** Minimum thumb size in px, so a huge list doesn't shrink the thumb to an ungrabbable sliver. */
    minThumbSize?: number
  }>(),
  {
    orientation: 'vertical',
    minThumbSize: 24,
  },
)

const trackRef = ref<HTMLElement | null>(null)
const isVertical = computed(() => props.orientation === 'vertical')

const scrollPos = ref(0)
const scrollSize = ref(0)
const clientSize = ref(0)
const trackSize = ref(0)
const isDragging = ref(false)

function readMetrics(el: HTMLElement): void {
  if (isVertical.value) {
    scrollPos.value = el.scrollTop
    scrollSize.value = el.scrollHeight
    clientSize.value = el.clientHeight
  } else {
    scrollPos.value = normalizeScrollLeft(el)
    scrollSize.value = el.scrollWidth
    clientSize.value = el.clientWidth
  }
}

function update(): void {
  const el = props.target()
  if (el) readMetrics(el)
}

const thumbRatio = computed(() => {
  if (scrollSize.value <= 0) return 1
  return Math.min(1, clientSize.value / scrollSize.value)
})

const maxScroll = computed(() => Math.max(0, scrollSize.value - clientSize.value))

const thumbOffsetRatio = computed(() => {
  if (maxScroll.value <= 0) return 0
  return scrollPos.value / maxScroll.value
})

const isNeeded = computed(() => thumbRatio.value < 1)

// Clamped to a minimum px size so a huge list (e.g. 100k rows) doesn't shrink the thumb
// to a sub-pixel sliver that's ungrabbable for mouse/touch/tests alike.
const thumbSizePx = computed(() => {
  if (trackSize.value <= 0) return 0
  return Math.min(trackSize.value, Math.max(props.minThumbSize, thumbRatio.value * trackSize.value))
})

const thumbStyle = computed(() => {
  const sizePx = `${thumbSizePx.value}px`
  const posPx = `${thumbOffsetRatio.value * (trackSize.value - thumbSizePx.value)}px`
  return isVertical.value
    ? { height: sizePx, top: posPx }
    : { width: sizePx, insetInlineStart: posPx }
})

let elRO: ResizeObserver | null = null
let contentRO: ResizeObserver | null = null
let attachedEl: HTMLElement | null = null

function detach(): void {
  if (attachedEl) attachedEl.removeEventListener('scroll', update)
  elRO?.disconnect()
  elRO = null
  contentRO?.disconnect()
  contentRO = null
  attachedEl = null
}

function attach(): void {
  const el = props.target()
  if (!el || el === attachedEl) {
    update()
    return
  }
  detach()
  attachedEl = el
  el.addEventListener('scroll', update, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    elRO = new ResizeObserver(update)
    elRO.observe(el)
    const content = el.firstElementChild
    if (content) {
      contentRO = new ResizeObserver(update)
      contentRO.observe(content)
    }
  }
  update()
}

function onThumbPointerDown(e: PointerEvent): void {
  const el = props.target()
  const track = trackRef.value
  if (!el || !track) return
  e.preventDefault()
  isDragging.value = true

  const trackRect = track.getBoundingClientRect()
  const trackPx = isVertical.value ? trackRect.height : trackRect.width
  const draggablePx = Math.max(1, trackPx - thumbSizePx.value)
  const startClient = isVertical.value ? e.clientY : e.clientX
  const startScroll = isVertical.value ? el.scrollTop : normalizeScrollLeft(el)

  function onMove(ev: PointerEvent): void {
    const client = isVertical.value ? ev.clientY : ev.clientX
    const deltaPx = client - startClient
    const deltaScroll = (deltaPx / draggablePx) * maxScroll.value
    const next = Math.min(maxScroll.value, Math.max(0, startScroll + deltaScroll))
    if (isVertical.value) el!.scrollTop = next
    else setNormalizedScrollLeft(el!, next)
  }

  function onUp(): void {
    isDragging.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onTrackPointerDown(e: PointerEvent): void {
  if (e.target !== trackRef.value) return
  const el = props.target()
  const track = trackRef.value
  if (!el || !track) return
  const rect = track.getBoundingClientRect()
  const clickPx = isVertical.value ? e.clientY - rect.top : e.clientX - rect.left
  const trackPx = isVertical.value ? rect.height : rect.width
  const thumbPx = thumbSizePx.value
  const targetRatio = Math.min(1, Math.max(0, (clickPx - thumbPx / 2) / (trackPx - thumbPx || 1)))
  const next = targetRatio * maxScroll.value
  if (isVertical.value) el.scrollTop = next
  else setNormalizedScrollLeft(el, next)
}

// `target()` typically depends on a sibling component's template ref, which may resolve
// later than this component's own mount (e.g. behind Suspense/defineAsyncComponent).
// Poll a few animation frames rather than assuming one retry is enough.
let pollRAF: number | null = null

function pollAttach(attemptsLeft = 60): void {
  pollRAF = null
  attach()
  if (!attachedEl && attemptsLeft > 0) {
    pollRAF = requestAnimationFrame(() => pollAttach(attemptsLeft - 1))
  }
}

let trackRO: ResizeObserver | null = null

function readTrackSize(): void {
  const track = trackRef.value
  if (!track) return
  const rect = track.getBoundingClientRect()
  trackSize.value = isVertical.value ? rect.height : rect.width
}

onMounted(() => {
  readTrackSize()
  if (trackRef.value && typeof ResizeObserver !== 'undefined') {
    trackRO = new ResizeObserver(readTrackSize)
    trackRO.observe(trackRef.value)
  }
  nextTick(() => pollAttach())
})

onUnmounted(() => {
  if (pollRAF !== null) cancelAnimationFrame(pollRAF)
  trackRO?.disconnect()
  detach()
})

defineExpose({ refresh: attach })
</script>

<template>
  <div
    ref="trackRef"
    class="vvsk-scrollbar"
    :class="[
      isVertical ? 'vvsk-scrollbar--vertical' : 'vvsk-scrollbar--horizontal',
      { 'vvsk-scrollbar--hidden': !isNeeded },
    ]"
    @pointerdown="onTrackPointerDown"
  >
    <div
      class="vvsk-scrollbar__thumb"
      :class="{ 'vvsk-scrollbar__thumb--dragging': isDragging }"
      :style="thumbStyle"
      @pointerdown.stop="onThumbPointerDown"
    />
  </div>
</template>

<style scoped>
.vvsk-scrollbar {
  position: relative;
  background: var(--vvsk-scrollbar-track, transparent);
  border-radius: calc(var(--vvsk-scrollbar-size, 10px) / 2);
}

.vvsk-scrollbar--vertical {
  width: var(--vvsk-scrollbar-size, 10px);
  height: 100%;
}

.vvsk-scrollbar--horizontal {
  height: var(--vvsk-scrollbar-size, 10px);
  width: 100%;
}

.vvsk-scrollbar--hidden {
  visibility: hidden;
}

.vvsk-scrollbar__thumb {
  position: absolute;
  background: var(--vvsk-scrollbar-thumb, rgb(255, 255, 255, 0.25));
  border-radius: inherit;
  cursor: pointer;
  touch-action: none;
}

.vvsk-scrollbar--vertical .vvsk-scrollbar__thumb {
  left: 0;
  right: 0;
}

.vvsk-scrollbar--horizontal .vvsk-scrollbar__thumb {
  top: 0;
  bottom: 0;
}

.vvsk-scrollbar__thumb:hover,
.vvsk-scrollbar__thumb--dragging {
  background: var(--vvsk-scrollbar-thumb-hover, rgb(255, 255, 255, 0.4));
}
</style>
