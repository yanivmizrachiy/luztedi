import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import mammoth from 'mammoth'

function stableId(input) {
  return `doc-${createHash('sha256').update(input).digest('hex').slice(0, 20)}`
}

function isoTodayLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isISODate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

function normalizeTime(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const m = v.match(/^(\d{1,2})[:.](\d{2})$/)
  if (!m) return ''
  const hh = String(Number(m[1])).padStart(2, '0')
  const mm = m[2]
  return `${hh}:${mm}`
}

function parseIsoDateFromText(text, defaultYear) {
  const t = String(text || '')

  // ISO
  const iso = t.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return { date: iso[1], uncertain: false }

  // DD/MM/YYYY or D/M/YYYY
  const dmy = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (dmy) {
    const dd = String(Number(dmy[1])).padStart(2, '0')
    const mm = String(Number(dmy[2])).padStart(2, '0')
    return { date: `${dmy[3]}-${mm}-${dd}`, uncertain: false }
  }

  // DD.MM.YYYY
  const dmyDot = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)
  if (dmyDot) {
    const dd = String(Number(dmyDot[1])).padStart(2, '0')
    const mm = String(Number(dmyDot[2])).padStart(2, '0')
    return { date: `${dmyDot[3]}-${mm}-${dd}`, uncertain: false }
  }

  // DD/MM (missing year)
  const dm = t.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (dm && defaultYear) {
    const dd = String(Number(dm[1])).padStart(2, '0')
    const mm = String(Number(dm[2])).padStart(2, '0')
    return { date: `${defaultYear}-${mm}-${dd}`, uncertain: true }
  }

  return { date: '', uncertain: true }
}

function parseDateOrRangeFromCell(dateText, defaultYear) {
  const t = normalizeWhitespace(dateText)
  if (!t) return []

  // ISO
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (iso) return [{ date: iso[1], uncertain: false }]

  // D/M/YYYY
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const dd = String(Number(dmy[1])).padStart(2, '0')
    const mm = String(Number(dmy[2])).padStart(2, '0')
    return [{ date: `${dmy[3]}-${mm}-${dd}`, uncertain: false }]
  }

  // Range: 3-4/3 (days within same month)
  const rangeDm = t.match(/^(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/)
  if (rangeDm) {
    const fromDay = Number(rangeDm[1])
    const toDay = Number(rangeDm[2])
    const month = String(Number(rangeDm[3])).padStart(2, '0')
    const year = defaultYear || String(new Date().getFullYear())
    const uncertain = !defaultYear
    const out = []
    const step = fromDay <= toDay ? 1 : -1
    for (let d = fromDay; d !== toDay + step; d += step) {
      const dd = String(d).padStart(2, '0')
      out.push({ date: `${year}-${month}-${dd}`, uncertain })
    }
    return out
  }

  // Range across months: 24/3-8/4
  const rangeAcross = t.match(/^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/)
  if (rangeAcross) {
    const y = defaultYear || String(new Date().getFullYear())
    const uncertain = !defaultYear
    const fromDay = Number(rangeAcross[1])
    const fromMonth = Number(rangeAcross[2])
    const toDay = Number(rangeAcross[3])
    const toMonth = Number(rangeAcross[4])

    const start = new Date(Number(y), fromMonth - 1, fromDay)
    const end = new Date(Number(y), toMonth - 1, toDay)
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return []

    const out = []
    const cur = new Date(start)
    while (cur <= end) {
      const yyyy = cur.getFullYear()
      const mm = String(cur.getMonth() + 1).padStart(2, '0')
      const dd = String(cur.getDate()).padStart(2, '0')
      out.push({ date: `${yyyy}-${mm}-${dd}`, uncertain })
      cur.setDate(cur.getDate() + 1)
    }
    return out
  }

  // Single: 15/2 (missing year)
  const dm = t.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (dm) {
    const dd = String(Number(dm[1])).padStart(2, '0')
    const mm = String(Number(dm[2])).padStart(2, '0')
    const year = defaultYear || String(new Date().getFullYear())
    return [{ date: `${year}-${mm}-${dd}`, uncertain: !defaultYear }]
  }

  return []
}

function detectTimeRange(text) {
  const t = String(text || '')
  // 09:00-10:30 / 9.00–10.30
  const m = t.match(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/)
  if (!m) return { startTime: '', endTime: '' }
  return { startTime: normalizeTime(m[1]), endTime: normalizeTime(m[2]) }
}

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripTags(html) {
  return normalizeWhitespace(decodeHtmlEntities(String(html || '').replace(/<[^>]*>/g, ' ')))
}

function extractTableRows(html) {
  const out = []
  const h = String(html || '')
  const rowRe = /<tr[\s\S]*?<\/tr>/gi
  const cellRe = /<(td|th)[\s\S]*?>[\s\S]*?<\/(td|th)>/gi

  const rows = h.match(rowRe) || []
  for (const rowHtml of rows) {
    const cells = []
    const matches = rowHtml.match(cellRe) || []
    for (const cellHtml of matches) {
      cells.push(stripTags(cellHtml))
    }
    // Important: keep empty cells to preserve column alignment.
    const cleaned = cells.map((c) => normalizeWhitespace(c))
    const hasAny = cleaned.some((c) => Boolean(c))
    if (hasAny) out.push(cleaned)
  }
  return out
}

function findHeaderMap(cells) {
  const map = {}
  const norm = cells.map((c) => normalizeWhitespace(c))
  for (let i = 0; i < norm.length; i++) {
    const v = norm[i]
    if (v === 'יום') map.day = i
    if (v === 'תאריך') map.date = i
    if (v === 'שעה') map.time = i
    if (v === 'סוג הפעילות' || v === 'סוג פעילות' || v === 'פעילות') map.activity = i
  }
  if (typeof map.date === 'number' && typeof map.activity === 'number') return map
  return null
}

function classify(text) {
  const t = String(text || '').toLowerCase()
  const exam = /(מבחן|בוחן|מתכונת|quiz|exam)/.test(t)
  const holiday = /(חופשה|חופש|חג|אין\s+לימודים|שביתה|יום\s+חופשי)/.test(t)
  if (exam) return 'exam'
  if (holiday) return 'holiday'
  return 'schedule'
}

function scheduleType(text) {
  const t = String(text || '').toLowerCase()
  if (/(טיול|סיור|מחנה|שדה)/.test(t)) return { type: 'trip', uncertain: false }
  if (/(ישיבה|אסיפה|השתלמות|כנס|פגישה|הרצאה)/.test(t))
    return { type: 'meeting', uncertain: false }
  return { type: 'meeting', uncertain: true }
}

function extractSubject(text) {
  const s = normalizeWhitespace(text)
  // Try: "מבחן במתמטיקה" / "מבחן: מתמטיקה"
  const m1 = s.match(/מבחן\s*(?:ב|ב־|ב )?(.+?)(?:$|\(|-|–)/)
  if (m1) {
    const v = normalizeWhitespace(m1[1])
    if (v && v.length <= 60) return v
  }
  const m2 = s.match(/(?:מבחן|בוחן|מתכונת)\s*[:：]\s*(.+?)(?:$|\(|-|–)/)
  if (m2) {
    const v = normalizeWhitespace(m2[1])
    if (v && v.length <= 60) return v
  }
  return ''
}

function extractReason(text) {
  const s = normalizeWhitespace(text)
  const m = s.match(/(?:חופשה|חופש|חג|אין לימודים)\s*[:：-]?\s*(.+)$/)
  if (m) {
    const v = normalizeWhitespace(m[1])
    if (v && v.length <= 120) return v
  }
  return ''
}

function upsertMergeById(items, item) {
  const idx = items.findIndex((x) => x.id === item.id)
  if (idx === -1) return { items: [...items, item], merged: false }
  const prev = items[idx]
  const mergedNotes = [prev.notes, item.notes]
    .filter(Boolean)
    .join('\n')
    .trim()
  const nextItem = {
    ...prev,
    ...item,
    notes: mergedNotes || undefined,
  }
  const next = [...items]
  next[idx] = nextItem
  return { items: next, merged: true }
}

function loadArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      out[a.slice(2)] = args[i + 1]
      i++
    }
  }
  return out
}

const args = loadArgs()
const docxPath = args.docx
const defaultYear = args.year ? String(args.year).trim() : ''
if (!docxPath) {
  console.error(
    'Usage: node scripts/import-word-docx.mjs --docx <path-to-docx> [--year YYYY]',
  )
  process.exit(1)
}
if (defaultYear && !/^\d{4}$/.test(defaultYear)) {
  console.error('--year must be YYYY')
  process.exit(1)
}

const absDocx = path.resolve(process.cwd(), docxPath)
const [{ value: rawText }, { value: htmlValue }] = await Promise.all([
  mammoth.extractRawText({ path: absDocx }),
  mammoth.convertToHtml({ path: absDocx }),
])

const html = String(htmlValue || '')
const tableRows = extractTableRows(html)

const lines = String(rawText || '')
  .split(/\r?\n/)
  .map(normalizeWhitespace)
  .filter(Boolean)

const schedulePath = path.resolve(process.cwd(), 'data/schedule.json')
const current = JSON.parse(await readFile(schedulePath, 'utf8'))

let next = {
  version: 1,
  schedule: Array.isArray(current.schedule) ? current.schedule : [],
  exams: Array.isArray(current.exams) ? current.exams : [],
  holidays: Array.isArray(current.holidays) ? current.holidays : [],
}

const uncertain = []
let added = { schedule: 0, exams: 0, holidays: 0 }
let merged = { schedule: 0, exams: 0, holidays: 0 }

const today = isoTodayLocal()

function addItem(kind, item, flags) {
  const { effectiveDateUncertain, extraUncertainReason } = flags || {}

  if (kind === 'holiday') {
    const res = upsertMergeById(next.holidays, item)
    next.holidays = res.items
    if (res.merged) merged.holidays++
    else added.holidays++
    if (effectiveDateUncertain || extraUncertainReason) {
      uncertain.push({ source: 'docx', reason: extraUncertainReason || 'holiday-uncertain', text: item.notes || item.title })
    }
    return
  }

  if (kind === 'exam') {
    const res = upsertMergeById(next.exams, item)
    next.exams = res.items
    if (res.merged) merged.exams++
    else added.exams++
    if (effectiveDateUncertain || extraUncertainReason) {
      uncertain.push({ source: 'docx', reason: extraUncertainReason || 'exam-uncertain', text: item.notes || item.title })
    }
    return
  }

  const res = upsertMergeById(next.schedule, item)
  next.schedule = res.items
  if (res.merged) merged.schedule++
  else added.schedule++
  if (effectiveDateUncertain || extraUncertainReason) {
    uncertain.push({ source: 'docx', reason: extraUncertainReason || 'schedule-uncertain', text: item.notes || item.title })
  }
}

function importFromTableRows() {
  if (!tableRows.length) return false

  // Find header row (יום/תאריך/שעה/סוג הפעילות)
  let headerMap = null
  let startIdx = 0
  for (let i = 0; i < tableRows.length; i++) {
    const maybe = findHeaderMap(tableRows[i])
    if (maybe) {
      headerMap = maybe
      startIdx = i + 1
      break
    }
  }

  // If not found, assume fixed order (day, date, time, activity)
  if (!headerMap) {
    headerMap = { day: 0, date: 1, time: 2, activity: 3 }
    startIdx = 0
  }

  let importedAny = false

  for (let i = startIdx; i < tableRows.length; i++) {
    const row = tableRows[i]
    if (row.length < 2) continue

    let dayText = row[headerMap.day] ?? ''
    let dateText = row[headerMap.date] ?? ''
    let timeText = row[headerMap.time] ?? ''
    let activityText = row[headerMap.activity] ?? ''

    // If activity cell is missing due to merged cells, fall back to last non-empty cell.
    if (!normalizeWhitespace(activityText)) {
      for (let j = row.length - 1; j >= 0; j--) {
        const v = normalizeWhitespace(row[j])
        if (v) {
          activityText = v
          break
        }
      }
    }

    // Heuristic: if time cell contains activity text (no digits/time), and activity is empty or equal,
    // treat it as activity and clear time.
    const timeLooksLikeTime = /\d/.test(String(timeText || ''))
    if (!timeLooksLikeTime && normalizeWhitespace(timeText) && (!normalizeWhitespace(activityText) || normalizeWhitespace(activityText) === normalizeWhitespace(timeText))) {
      activityText = timeText
      timeText = ''
    }

    const activity = normalizeWhitespace(activityText)
    const dateParts = parseDateOrRangeFromCell(dateText, defaultYear)

    if (!activity || !dateParts.length) {
      // Skip titles/headers but track uncertain if it looks like real data
      const looksLikeDate = /\d{1,2}\/\d{1,2}/.test(dateText)
      if (looksLikeDate || activity) {
        uncertain.push({ source: 'docx', reason: 'table-row-unparsed', text: row.join(' | ') })
      }
      continue
    }

    const timeRange = detectTimeRange(timeText)
    const kind = classify(activity)

    for (const dp of dateParts) {
      const effectiveDate = dp.date
      if (!isISODate(effectiveDate)) {
        uncertain.push({ source: 'docx', reason: 'invalid-date', text: row.join(' | ') })
        continue
      }

      const baseNotes = [
        'מקור: Word',
        `יום: ${dayText || 'לא צוין'}`,
        `תאריך (מקורי): ${dateText || 'לא צוין'}`,
        `שעה (מקורי): ${timeText || 'לא צוין'}`,
        `טקסט מקורי: ${activity}`,
      ].join('\n')

      const noteParts = []
      if (dp.uncertain) noteParts.push('תאריך משוער (חסרה שנה / נרמול חלקי)')
      const timeUncertain = Boolean(timeText) && !(timeRange.startTime && timeRange.endTime)
      if (timeUncertain) noteParts.push('שעה לא בפורמט HH:MM-HH:MM (נשמר ב-notes)')

      const notes = [
        baseNotes,
        noteParts.length ? `אי-ודאות: ${noteParts.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      if (kind === 'holiday') {
        const reason = extractReason(activity) || activity
        const id = stableId(`${kind}|${effectiveDate}|${reason}|${activity}`)
        const item = {
          kind: 'holiday',
          id,
          date: effectiveDate,
          title: activity,
          reason,
          notes,
        }
        addItem('holiday', item, {
          effectiveDateUncertain: dp.uncertain,
          extraUncertainReason: reason === 'לא צוין' ? 'holiday-missing-reason' : '',
        })
        importedAny = true
        continue
      }

      if (kind === 'exam') {
        const subject = extractSubject(activity) || 'לא צוין'
        const id = stableId(
          `${kind}|${effectiveDate}|${timeRange.startTime}|${timeRange.endTime}|${subject}|${activity}`,
        )
        const item = {
          kind: 'exam',
          id,
          date: effectiveDate,
          title: activity,
          subject,
          startTime: timeRange.startTime || undefined,
          endTime: timeRange.endTime || undefined,
          notes,
        }
        addItem('exam', item, {
          effectiveDateUncertain: dp.uncertain,
          extraUncertainReason: subject === 'לא צוין' ? 'exam-missing-subject' : '',
        })
        importedAny = true
        continue
      }

      const { type, uncertain: typeUncertain } = scheduleType(activity)
      const id = stableId(
        `schedule|${type}|${effectiveDate}|${timeRange.startTime}|${timeRange.endTime}|${activity}`,
      )
      const item = {
        kind: 'schedule',
        id,
        date: effectiveDate,
        title: activity,
        type,
        startTime: timeRange.startTime || undefined,
        endTime: timeRange.endTime || undefined,
        notes,
      }
      addItem('schedule', item, {
        effectiveDateUncertain: dp.uncertain,
        extraUncertainReason: typeUncertain ? 'schedule-uncertain-type' : '',
      })
      importedAny = true
    }
  }

  return importedAny
}

function importFromRawTextFallback() {
  // Heuristic: some docs have a date line followed by detail lines.
  let currentDate = ''
  let currentDateUncertain = false

  for (const line of lines) {
    const dateInfo = parseIsoDateFromText(line, defaultYear)
    const hasDate = Boolean(dateInfo.date)
    const { startTime, endTime } = detectTimeRange(line)

    if (hasDate) {
      currentDate = dateInfo.date
      currentDateUncertain = dateInfo.uncertain

      const remainder = normalizeWhitespace(
        line
          .replace(dateInfo.date, '')
          .replace(/\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{4})?\b/, ''),
      )
      if (!remainder) continue
    }

    const effectiveDate = hasDate ? dateInfo.date : currentDate
    const effectiveDateUncertain = hasDate ? dateInfo.uncertain : currentDateUncertain

    if (!effectiveDate || !isISODate(effectiveDate)) {
      uncertain.push({ source: 'docx', reason: 'missing-date', text: line })
      continue
    }

    const kind = classify(line)
    const title = normalizeWhitespace(
      line
        .replace(/\b\d{4}-\d{2}-\d{2}\b/, '')
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/, '')
        .replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/, '')
        .replace(/\b\d{1,2}\/\d{1,2}\b/, '')
        .replace(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/, '')
        .replace(/^[—–\-:：]+/, '')
        .trim(),
    )

    const baseNotes = `מקור: Word\nטקסט מקורי: ${line}`
    const noteParts = []
    if (effectiveDateUncertain) noteParts.push('תאריך משוער (חסר שנה / נרמול חלקי)')
    if (startTime && !endTime) noteParts.push('שעה חלקית / לא זוהה טווח מלא')
    const notes = [
      baseNotes,
      noteParts.length ? `אי-ודאות: ${noteParts.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    if (kind === 'holiday') {
      const reason = extractReason(line) || title || 'לא צוין'
      const id = stableId(`${kind}|${effectiveDate}|${reason}|${title}`)
      const item = {
        kind: 'holiday',
        id,
        date: effectiveDate,
        title: title || reason,
        reason,
        notes,
      }
      addItem('holiday', item, { effectiveDateUncertain })
      continue
    }

    if (kind === 'exam') {
      const subject = extractSubject(line) || 'לא צוין'
      const id = stableId(
        `${kind}|${effectiveDate}|${startTime}|${endTime}|${subject}|${title}`,
      )
      const item = {
        kind: 'exam',
        id,
        date: effectiveDate,
        title: title || subject,
        subject,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        notes,
      }
      addItem('exam', item, { effectiveDateUncertain })
      continue
    }

    const { type, uncertain: typeUncertain } = scheduleType(line)
    const id = stableId(`${kind}|${type}|${effectiveDate}|${startTime}|${endTime}|${title}`)
    const item = {
      kind: 'schedule',
      id,
      date: effectiveDate,
      title: title || 'אירוע',
      type,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      notes,
    }
    addItem('schedule', item, { effectiveDateUncertain, extraUncertainReason: typeUncertain ? 'schedule-uncertain-type' : '' })
  }
}

const importedFromTable = importFromTableRows()
if (!importedFromTable) {
  importFromRawTextFallback()
}

// Sort chronologically for convenience
next.schedule.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
next.exams.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')))
next.holidays.sort((a, b) => a.date.localeCompare(b.date))

await writeFile(schedulePath, JSON.stringify(next, null, 2) + '\n', 'utf8')

const summary = {
  source: 'word-docx',
  docx: absDocx,
  today,
  added,
  merged,
  uncertainCount: uncertain.length,
  uncertain: uncertain.slice(0, 50),
}
await writeFile(
  path.resolve(process.cwd(), 'data/import-summary.word.json'),
  JSON.stringify(summary, null, 2) + '\n',
  'utf8',
)

console.log('Import complete')
console.log('Added:', added)
console.log('Merged:', merged)
console.log('Uncertain rows:', uncertain.length)
console.log('Wrote: data/import-summary.word.json')
