import { describe, it, expect } from 'vitest'
import { computeBlurAmount } from '../utils/motionBlur'

describe('computeBlurAmount', () => {
  it('returns 0 for zero velocity', () => {
    expect(computeBlurAmount(0)).toBe(0)
  })

  it('returns 0 for negative-magnitude velocity treated as zero', () => {
    expect(computeBlurAmount(-0)).toBe(0)
  })

  it('scales linearly with velocity magnitude', () => {
    // sensitivity=3, maxBlur=6 (defaults) → velocity=1.5 → half of maxBlur
    expect(computeBlurAmount(1.5)).toBeCloseTo(3, 5)
  })

  it('treats negative velocity the same as positive (uses magnitude)', () => {
    expect(computeBlurAmount(-1.5)).toBeCloseTo(computeBlurAmount(1.5), 5)
  })

  it('clamps to maxBlur for very high velocity', () => {
    expect(computeBlurAmount(1000)).toBe(6)
  })

  it('respects custom maxBlur and sensitivity options', () => {
    expect(computeBlurAmount(2, { maxBlur: 10, sensitivity: 2 })).toBe(10)
    expect(computeBlurAmount(1, { maxBlur: 10, sensitivity: 2 })).toBeCloseTo(5, 5)
  })

  it('returns 0 when sensitivity is 0 (avoids division by zero)', () => {
    expect(computeBlurAmount(5, { sensitivity: 0 })).toBe(0)
  })
})
