const monthHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

const dayHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isSameDay(left: Date, right: Date): boolean {
  return toDateKey(left) === toDateKey(right)
}

export function getMonthGrid(date: Date): Date[] {
  const firstDay = startOfMonth(date)
  const gridStart = addDays(firstDay, -firstDay.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export function formatMonthHeading(date: Date): string {
  return monthHeadingFormatter.format(date)
}

export function formatDayHeading(date: Date): string {
  return dayHeadingFormatter.format(date)
}
