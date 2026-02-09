import type { ScheduleData } from '../types'

const KEY = 'luztedi.localOverride.v1'

export function loadLocalOverride(): ScheduleData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScheduleData
  } catch {
    return null
  }
}

export function saveLocalOverride(data: ScheduleData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearLocalOverride(): void {
  localStorage.removeItem(KEY)
}
