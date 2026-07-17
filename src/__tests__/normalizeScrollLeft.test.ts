import { describe, it, expect } from 'vitest'
import {
  normalizeScrollLeft,
  rawScrollLeftFor,
  setNormalizedScrollLeft,
} from '../utils/normalizeScrollLeft'

function makeEl(opts: {
  direction?: 'ltr' | 'rtl'
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
}): HTMLElement {
  const el = document.createElement('div')
  el.style.direction = opts.direction ?? 'ltr'
  const state = { scrollLeft: opts.scrollLeft }
  Object.defineProperties(el, {
    scrollLeft: {
      get: () => state.scrollLeft,
      set: (v: number) => {
        state.scrollLeft = v
      },
      configurable: true,
    },
    scrollWidth: { value: opts.scrollWidth, configurable: true },
    clientWidth: { value: opts.clientWidth, configurable: true },
  })
  document.body.appendChild(el)
  return el
}

describe('normalizeScrollLeft', () => {
  it('returns raw scrollLeft unchanged in LTR', () => {
    const el = makeEl({ direction: 'ltr', scrollLeft: 150, scrollWidth: 1000, clientWidth: 300 })
    expect(normalizeScrollLeft(el)).toBe(150)
  })

  it('returns 0 for an unscrolled LTR element', () => {
    const el = makeEl({ direction: 'ltr', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    expect(normalizeScrollLeft(el)).toBe(0)
  })

  it('normalizes negative RTL scrollLeft to a "distance from start" value', () => {
    // scrollWidth=1000, clientWidth=300 → max scroll distance = 700.
    // At the very start edge in RTL, scrollLeft = 0 → normalized should be 700 (fully scrolled).
    const el = makeEl({ direction: 'rtl', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    expect(normalizeScrollLeft(el)).toBe(700)
  })

  it('normalizes a fully-scrolled-to-start RTL position to 0', () => {
    // Fully scrolled toward the start edge in RTL → scrollLeft = -(scrollWidth-clientWidth) = -700
    const el = makeEl({ direction: 'rtl', scrollLeft: -700, scrollWidth: 1000, clientWidth: 300 })
    expect(normalizeScrollLeft(el)).toBe(0)
  })

  it('normalizes a partial RTL scroll position', () => {
    const el = makeEl({ direction: 'rtl', scrollLeft: -300, scrollWidth: 1000, clientWidth: 300 })
    expect(normalizeScrollLeft(el)).toBe(400)
  })
})

describe('setNormalizedScrollLeft', () => {
  it('sets scrollLeft directly in LTR', () => {
    const el = makeEl({ direction: 'ltr', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    setNormalizedScrollLeft(el, 200)
    expect(el.scrollLeft).toBe(200)
  })

  it('is the inverse of normalizeScrollLeft in RTL', () => {
    const el = makeEl({ direction: 'rtl', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    setNormalizedScrollLeft(el, 250)
    expect(normalizeScrollLeft(el)).toBe(250)
  })

  it('sets scrollLeft to 0 (fully at start) in RTL when distance is maxScroll', () => {
    const el = makeEl({ direction: 'rtl', scrollLeft: -700, scrollWidth: 1000, clientWidth: 300 })
    setNormalizedScrollLeft(el, 700)
    expect(el.scrollLeft).toBe(0)
  })
})

describe('rawScrollLeftFor', () => {
  it('returns the distance unchanged in LTR', () => {
    const el = makeEl({ direction: 'ltr', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    expect(rawScrollLeftFor(el, 200)).toBe(200)
  })

  it('converts distance-from-start into a negative raw scrollLeft in RTL', () => {
    const el = makeEl({ direction: 'rtl', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    // maxScroll = 700; distance 300 → raw = 300 - 700 = -400
    expect(rawScrollLeftFor(el, 300)).toBe(-400)
  })

  it('matches what setNormalizedScrollLeft assigns', () => {
    const el = makeEl({ direction: 'rtl', scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    const raw = rawScrollLeftFor(el, 450)
    setNormalizedScrollLeft(el, 450)
    expect(el.scrollLeft).toBe(raw)
  })
})
