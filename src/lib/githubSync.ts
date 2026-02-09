import type { ScheduleData } from '../types'
import { clearLocalOverride, loadLocalOverride, saveLocalOverride } from './storage'

export type LoadResult = {
  source: 'github'
  data: ScheduleData
  localOverrideApplied: boolean
}

export async function loadScheduleFromRepo(): Promise<LoadResult> {
  const url = new URL('data/schedule.json', window.location.origin + import.meta.env.BASE_URL)
  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load schedule.json (${response.status})`)
  }
  const githubData = (await response.json()) as ScheduleData

  const local = loadLocalOverride()
  if (local) return { source: 'github', data: local, localOverrideApplied: true }
  return { source: 'github', data: githubData, localOverrideApplied: false }
}

export function applyLocalOverride(data: ScheduleData): void {
  saveLocalOverride(data)
}

export function resetToRepoTruth(): void {
  clearLocalOverride()
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}
