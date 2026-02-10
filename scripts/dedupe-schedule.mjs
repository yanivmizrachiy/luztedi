import fs from 'node:fs'

const DATA_PATH = 'data/schedule.json'

function normalizeTitle(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/["'׳״]/g, '')
    .replace(/[–—:.,!()?[\]{}-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function mergeNotes(items) {
  const lines = new Set()
  for (const it of items) {
    for (const line of String(it.notes ?? '').split('\n')) {
      const v = line.trim()
      if (v) lines.add(v)
    }
  }
  return lines.size ? [...lines].join('\n') : undefined
}

function score(it) {
  let s = 0
  if (it.startTime) s += 10
  if (it.endTime) s += 5
  if (it.description) s += 2
  if (it.location) s += 1
  if (it.group) s += 1
  s += Math.min(3, Math.floor(String(it.notes ?? '').length / 120))
  return s
}

function dedupeStable(list, keyFn) {
  const groups = new Map()
  const order = []

  for (const item of list) {
    const key = keyFn(item)
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(item)
  }

  const out = []
  const removed = []

  for (const key of order) {
    const items = groups.get(key)
    if (items.length === 1) {
      out.push(items[0])
      continue
    }

    const sorted = [...items].sort((a, b) => score(b) - score(a))
    const base = sorted[0]
    const merged = { ...base }

    const notes = mergeNotes(items)
    if (notes) merged.notes = notes

    out.push(merged)

    for (const it of items) {
      if (it !== base) removed.push(it.id)
    }
  }

  return { out, removed }
}

const raw = fs.readFileSync(DATA_PATH, 'utf8')
const data = JSON.parse(raw)

const before = {
  schedule: data.schedule?.length ?? 0,
  exams: data.exams?.length ?? 0,
  holidays: data.holidays?.length ?? 0,
}

const scheduleRes = dedupeStable(data.schedule ?? [], (it) =>
  ['schedule', it.date, it.type ?? '', normalizeTitle(it.title)].join('|'),
)

const examsRes = dedupeStable(data.exams ?? [], (it) =>
  ['exam', it.date, it.subject ?? '', normalizeTitle(it.title ?? it.subject)].join('|'),
)

const holidaysRes = dedupeStable(data.holidays ?? [], (it) =>
  ['holiday', it.date, normalizeTitle(it.title), normalizeTitle(it.reason)].join('|'),
)

const cleaned = {
  ...data,
  schedule: scheduleRes.out,
  exams: examsRes.out,
  holidays: holidaysRes.out,
}

fs.writeFileSync(DATA_PATH, JSON.stringify(cleaned, null, 2) + '\n', 'utf8')

const after = {
  schedule: cleaned.schedule.length,
  exams: cleaned.exams.length,
  holidays: cleaned.holidays.length,
}

console.log('dedupe-schedule done')
console.log('before', before)
console.log('after ', after)
console.log('removed', {
  schedule: scheduleRes.removed.length,
  exams: examsRes.removed.length,
  holidays: holidaysRes.removed.length,
})
