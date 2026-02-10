import type { ScheduleEventType } from './types'

export const SITE_TITLE =
  'תיכון פסגת זאב ע"ש טדי קולק'

export function getEventLabel(type: ScheduleEventType): string {
  if (type === 'meeting') return 'ישיבה'
  if (type === 'trip') return 'טיול'
  return 'חופשה'
}

export function getEventColor(type: ScheduleEventType): {
  border: string
  badge: string
  text: string
} {
  if (type === 'meeting') {
    return {
      border: 'border-meeting-600',
      badge: 'bg-meeting-600 text-white',
      text: 'text-meeting-700',
    }
  }
  if (type === 'trip') {
    return {
      border: 'border-trip-600',
      badge: 'bg-trip-600 text-white',
      text: 'text-trip-700',
    }
  }
  return {
    border: 'border-holiday-900',
    badge: 'bg-holiday-900 text-white',
    text: 'text-holiday-900',
  }
}
