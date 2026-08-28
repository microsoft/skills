import { describe, expect, it } from 'vitest'
import { addDays, getMonthGrid, isSameDay, startOfMonth, toDateKey } from './calendar'

describe('calendar date helpers', () => {
  it('builds a six-week month grid starting on Sunday', () => {
    const days = getMonthGrid(new Date(2026, 7, 15))

    expect(days).toHaveLength(42)
    expect(days[0].getDay()).toBe(0)
    expect(toDateKey(days[0])).toBe('2026-07-26')
    expect(toDateKey(days[41])).toBe('2026-09-05')
  })

  it('formats local date keys without UTC conversion', () => {
    expect(toDateKey(new Date(2026, 0, 3, 23, 30))).toBe('2026-01-03')
  })

  it('handles date arithmetic across month boundaries', () => {
    expect(toDateKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01')
    expect(toDateKey(startOfMonth(new Date(2026, 10, 18)))).toBe('2026-11-01')
  })

  it('compares calendar days independently of time', () => {
    expect(isSameDay(new Date(2026, 4, 2, 8), new Date(2026, 4, 2, 20))).toBe(true)
  })
})
