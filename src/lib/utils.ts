import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, eachDayOfInterval, isWeekend, isSaturday, isSunday, addDays, startOfWeek, endOfWeek } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateShort(date: Date | string) {
  return format(new Date(date), 'MM/dd/yyyy')
}

// US Federal Holidays for a given year
export function getFederalHolidays(year: number): { date: Date; name: string }[] {
  const holidays: { date: Date; name: string }[] = []

  // New Year's Day - Jan 1 (observed)
  holidays.push({ date: observedDate(new Date(year, 0, 1)), name: "New Year's Day" })

  // MLK Day - 3rd Monday in January
  holidays.push({ date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day" })

  // Presidents Day - 3rd Monday in February
  holidays.push({ date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day" })

  // Memorial Day - Last Monday in May
  holidays.push({ date: lastWeekday(year, 4, 1), name: "Memorial Day" })

  // Juneteenth - June 19 (observed)
  holidays.push({ date: observedDate(new Date(year, 5, 19)), name: "Juneteenth" })

  // Independence Day - July 4 (observed)
  holidays.push({ date: observedDate(new Date(year, 6, 4)), name: "Independence Day" })

  // Labor Day - 1st Monday in September
  holidays.push({ date: nthWeekday(year, 8, 1, 1), name: "Labor Day" })

  // Columbus Day - 2nd Monday in October
  holidays.push({ date: nthWeekday(year, 9, 1, 2), name: "Columbus Day" })

  // Veterans Day - Nov 11 (observed)
  holidays.push({ date: observedDate(new Date(year, 10, 11)), name: "Veterans Day" })

  // Thanksgiving - 4th Thursday in November
  holidays.push({ date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving Day" })

  // Christmas Day - Dec 25 (observed)
  holidays.push({ date: observedDate(new Date(year, 11, 25)), name: "Christmas Day" })

  return holidays
}

function observedDate(date: Date): Date {
  const day = date.getDay()
  if (day === 0) return addDays(date, 1) // Sunday -> Monday
  if (day === 6) return addDays(date, -1) // Saturday -> Friday
  return date
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  let count = 0
  let date = new Date(year, month, 1)
  while (count < n) {
    if (date.getDay() === weekday) count++
    if (count < n) date = addDays(date, 1)
  }
  return date
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  let date = new Date(year, month + 1, 0) // Last day of month
  while (date.getDay() !== weekday) {
    date = addDays(date, -1)
  }
  return date
}

// Get all weekend days in a date range
export function getWeekendDaysInRange(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start, end }).filter(d => isWeekend(d))
}

// Check if a date is a Saturday
export function isSaturdayDate(date: Date): boolean {
  return isSaturday(date)
}

// Check if a date is a Sunday
export function isSundayDate(date: Date): boolean {
  return isSunday(date)
}

// Group dates by weekend (Sat+Sun pairs)
export function groupByWeekend(dates: Date[]): { saturday: Date; sunday: Date }[] {
  const weekends: { saturday: Date; sunday: Date }[] = []
  const saturdays = dates.filter(d => isSaturday(d))
  for (const sat of saturdays) {
    const sun = addDays(sat, 1)
    if (dates.some(d => d.getTime() === sun.getTime())) {
      weekends.push({ saturday: sat, sunday: sun })
    }
  }
  return weekends
}

// Check if date is adjacent to another date
export function isAdjacentDate(date1: Date, date2: Date): boolean {
  const diff = Math.abs(date1.getTime() - date2.getTime())
  return diff <= 7 * 24 * 60 * 60 * 1000 // Within 7 days
}

// Academic year runs July 1 – June 30
export function getAcademicYear(date: Date): string {
  const month = date.getMonth() // 0 = Jan, 6 = July
  const year = date.getFullYear()
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

export function getDayType(date: Date, holidays: Date[]): 'saturday' | 'sunday' | 'holiday' | 'weekday' {
  const isHoliday = holidays.some(h =>
    h.getFullYear() === date.getFullYear() &&
    h.getMonth() === date.getMonth() &&
    h.getDate() === date.getDate()
  )
  if (isHoliday) return 'holiday'
  if (isSaturday(date)) return 'saturday'
  if (isSunday(date)) return 'sunday'
  return 'weekday'
}
