import { describe, it, expect, beforeEach } from 'vitest'
import { PositionManager } from '../core/PositionManager'

describe('PositionManager', () => {
  describe('initialization', () => {
    it('creates correct totalSize with uniform heights', () => {
      const pm = new PositionManager(5, 50)
      expect(pm.totalSize).toBe(250)
    })

    it('works with count = 1', () => {
      const pm = new PositionManager(1, 100)
      expect(pm.totalSize).toBe(100)
      expect(pm.getOffset(0)).toBe(0)
      expect(pm.getHeight(0)).toBe(100)
    })

    it('works with large power-of-2 count', () => {
      const pm = new PositionManager(1024, 40)
      expect(pm.totalSize).toBe(1024 * 40)
    })

    it('works with non-power-of-2 count', () => {
      const pm = new PositionManager(100, 30)
      expect(pm.totalSize).toBe(3000)
    })
  })

  describe('getOffset()', () => {
    let pm: PositionManager

    beforeEach(() => {
      pm = new PositionManager(5, 50)
    })

    it('returns 0 for index 0', () => {
      expect(pm.getOffset(0)).toBe(0)
    })

    it('returns estimatedItemSize for index 1', () => {
      expect(pm.getOffset(1)).toBe(50)
    })

    it('returns cumulative sum for middle index', () => {
      expect(pm.getOffset(3)).toBe(150)
    })

    it('returns totalSize for index === count', () => {
      expect(pm.getOffset(5)).toBe(250)
    })

    it('returns totalSize for index > count', () => {
      expect(pm.getOffset(100)).toBe(250)
    })

    it('returns 0 for negative index', () => {
      expect(pm.getOffset(-1)).toBe(0)
    })

    it('reflects set() updates', () => {
      pm.set(0, 100) // was 50, now 100 → +50 delta
      expect(pm.getOffset(1)).toBe(100)
      expect(pm.getOffset(2)).toBe(150)
      expect(pm.getOffset(4)).toBe(250)
    })

    it('reflects multiple updates correctly', () => {
      pm.set(0, 10)
      pm.set(1, 20)
      pm.set(2, 30)
      // row 3 and 4 remain 50
      expect(pm.getOffset(0)).toBe(0)
      expect(pm.getOffset(1)).toBe(10)
      expect(pm.getOffset(2)).toBe(30)
      expect(pm.getOffset(3)).toBe(60)
      expect(pm.getOffset(4)).toBe(110)
    })
  })

  describe('set()', () => {
    it('updates totalSize after height change', () => {
      const pm = new PositionManager(3, 50)
      pm.set(1, 100)
      expect(pm.totalSize).toBe(200) // 50 + 100 + 50
    })

    it('no-op when same height is set again', () => {
      const pm = new PositionManager(3, 50)
      pm.set(1, 50)
      expect(pm.totalSize).toBe(150)
    })

    it('reduces totalSize when height decreases', () => {
      const pm = new PositionManager(3, 50)
      pm.set(0, 10)
      expect(pm.totalSize).toBe(110)
    })

    it('ignores out-of-bounds index', () => {
      const pm = new PositionManager(3, 50)
      pm.set(-1, 999)
      pm.set(3, 999)
      pm.set(100, 999)
      expect(pm.totalSize).toBe(150)
    })

    it('getHeight() returns updated value', () => {
      const pm = new PositionManager(5, 50)
      pm.set(2, 120)
      expect(pm.getHeight(2)).toBe(120)
    })

    it('supports setting all rows to different heights', () => {
      const pm = new PositionManager(4, 50)
      pm.set(0, 10)
      pm.set(1, 20)
      pm.set(2, 30)
      pm.set(3, 40)
      expect(pm.totalSize).toBe(100)
    })
  })

  describe('findIndex()', () => {
    let pm: PositionManager

    beforeEach(() => {
      pm = new PositionManager(5, 50) // offsets: 0, 50, 100, 150, 200
    })

    it('returns 0 for offset 0', () => {
      expect(pm.findIndex(0)).toBe(0)
    })

    it('returns 0 for offset inside first row', () => {
      expect(pm.findIndex(25)).toBe(0)
      expect(pm.findIndex(49)).toBe(0)
    })

    it('returns 1 at exact boundary of row 1', () => {
      expect(pm.findIndex(50)).toBe(1)
    })

    it('returns correct index for middle of list', () => {
      expect(pm.findIndex(100)).toBe(2)
      expect(pm.findIndex(149)).toBe(2)
    })

    it('returns last index for offset >= totalSize', () => {
      expect(pm.findIndex(250)).toBe(4)
      expect(pm.findIndex(9999)).toBe(4)
    })

    it('returns 0 for negative offset', () => {
      expect(pm.findIndex(-1)).toBe(0)
    })

    it('works with non-uniform heights', () => {
      const pm2 = new PositionManager(4, 50)
      pm2.set(0, 10) // 0–9
      pm2.set(1, 20) // 10–29
      pm2.set(2, 30) // 30–59
      pm2.set(3, 40) // 60–99

      expect(pm2.findIndex(0)).toBe(0)
      expect(pm2.findIndex(9)).toBe(0)
      expect(pm2.findIndex(10)).toBe(1)
      expect(pm2.findIndex(29)).toBe(1)
      expect(pm2.findIndex(30)).toBe(2)
      expect(pm2.findIndex(59)).toBe(2)
      expect(pm2.findIndex(60)).toBe(3)
    })
  })

  describe('getHeight()', () => {
    it('returns estimatedItemSize before any set()', () => {
      const pm = new PositionManager(5, 72)
      expect(pm.getHeight(0)).toBe(72)
      expect(pm.getHeight(4)).toBe(72)
    })

    it('returns updated height after set()', () => {
      const pm = new PositionManager(5, 72)
      pm.set(2, 150)
      expect(pm.getHeight(2)).toBe(150)
      // Others unchanged
      expect(pm.getHeight(1)).toBe(72)
    })
  })

  describe('prefix sum invariants', () => {
    it('getOffset(i) + getHeight(i) equals getOffset(i+1)', () => {
      const pm = new PositionManager(6, 50)
      pm.set(0, 30)
      pm.set(2, 80)
      pm.set(4, 10)

      for (let i = 0; i < 5; i++) {
        expect(pm.getOffset(i) + pm.getHeight(i)).toBeCloseTo(pm.getOffset(i + 1))
      }
    })

    it('findIndex(getOffset(i)) === i for all rows', () => {
      const pm = new PositionManager(10, 50)
      pm.set(3, 120)
      pm.set(7, 25)

      for (let i = 0; i < 10; i++) {
        const offset = pm.getOffset(i)
        expect(pm.findIndex(offset)).toBe(i)
      }
    })
  })

  describe('performance sanity', () => {
    it('handles 100k rows without error', () => {
      const pm = new PositionManager(100_000, 50)
      expect(pm.totalSize).toBe(5_000_000)

      pm.set(50_000, 200)
      expect(pm.totalSize).toBe(5_000_150)
      expect(pm.getOffset(50_001)).toBe(50_000 * 50 + 200)
    })
  })
})
