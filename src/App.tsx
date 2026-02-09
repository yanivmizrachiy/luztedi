import { useEffect, useMemo, useState } from 'react'
import type { AnyItem, ScheduleData } from './types'
import {
  applyLocalOverride,
  loadScheduleFromRepo,
  resetToRepoTruth,
} from './lib/githubSync'
import { Header } from './components/Header'
import { MonthlySummary } from './components/MonthlySummary'
import { BottomNav, type TabKey } from './components/BottomNav'
import { DailyPage } from './pages/DailyPage'
import { ExamsPage } from './pages/ExamsPage'
import { HolidaysPage } from './pages/HolidaysPage'
import { JsonTools } from './components/JsonTools'
import { ItemEditor, type EditorPreset } from './components/ItemEditor.tsx'

const EMPTY: ScheduleData = { version: 1, schedule: [], exams: [], holidays: [] }

function isoTodayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('daily')
  const [data, setData] = useState<ScheduleData>(EMPTY)
  const [selectedDate, setSelectedDate] = useState<string>(() => isoTodayLocal())
  const [now, setNow] = useState<Date>(() => new Date())
  const [loadingError, setLoadingError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorPreset, setEditorPreset] = useState<EditorPreset | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true
    loadScheduleFromRepo()
      .then((res) => {
        if (!alive) return
        setData(res.data)
      })
      .catch((err) => {
        if (!alive) return
        setLoadingError(err instanceof Error ? err.message : 'שגיאה בטעינת נתונים')
      })
    return () => {
      alive = false
    }
  }, [])

  const save = (next: ScheduleData) => {
    setData(next)
    applyLocalOverride(next)
  }

  const openAdd = (preset: EditorPreset) => {
    setEditorPreset(preset)
    setEditorOpen(true)
  }

  const openEdit = (id: string) => {
    setEditorPreset({ mode: 'edit', id })
    setEditorOpen(true)
  }

  const deleteById = (id: string) => {
    save({
      version: 1,
      schedule: data.schedule.filter((x) => x.id !== id),
      exams: data.exams.filter((x) => x.id !== id),
      holidays: data.holidays.filter((x) => x.id !== id),
    })
  }

  const allItems = useMemo<AnyItem[]>(
    () => [...data.schedule, ...data.exams, ...data.holidays],
    [data],
  )

  return (
    <div className="min-h-dvh bg-white">
      <Header below={<MonthlySummary data={data} />} />
      <aside
        className="fixed right-3 z-35 flex flex-col gap-2 max-sm:bottom-[84px] max-sm:top-auto top-[104px]"
        aria-label="קישורים קבועים"
      >
        <a
          className="min-w-[180px] rounded-xl bg-ink-950 px-3 py-2.5 text-center text-[13px] font-extrabold text-white shadow-soft transition hover:opacity-90 active:scale-[0.99] focus-visible:outline-none"
          href="/luz-tedi.docx"
          download
        >
          הורדת לוז Word
        </a>
        <a
          className="min-w-[180px] rounded-xl bg-trip-700 px-3 py-2.5 text-center text-[13px] font-extrabold text-white shadow-soft transition hover:opacity-90 active:scale-[0.99] focus-visible:outline-none"
          href="https://docs.google.com/spreadsheets/d/1bG6RsGZK39lNogtTBS5_voJz0WVcRu2D/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
        >
          פתיחת Google Sheet
        </a>
      </aside>

      {loadingError ? (
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-extrabold text-red-700">
            {loadingError}
          </div>
        </div>
      ) : null}

      {tab === 'daily' ? (
        <>
          <DailyPage
            data={data}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            now={now}
            onAdd={() =>
              openAdd({ mode: 'create', kind: 'schedule', defaultDate: selectedDate })
            }
            onEdit={openEdit}
            onDelete={deleteById}
          />
        </>
      ) : null}

      {tab === 'exams' ? (
        <>
          <ExamsPage
            data={data}
            onAdd={() => openAdd({ mode: 'create', kind: 'exam', defaultDate: isoTodayLocal() })}
            onEdit={openEdit}
            onDelete={deleteById}
          />
        </>
      ) : null}

      {tab === 'holidays' ? (
        <>
          <HolidaysPage
            data={data}
            onAdd={() =>
              openAdd({ mode: 'create', kind: 'holiday', defaultDate: isoTodayLocal() })
            }
            onEdit={openEdit}
            onDelete={deleteById}
          />
        </>
      ) : null}

      <div className="mx-auto max-w-md px-4 pb-24">
        <JsonTools data={data} setData={save} />
      </div>

      <BottomNav active={tab} onChange={setTab} />

      {editorOpen && editorPreset ? (
        <ItemEditor
          preset={editorPreset}
          items={allItems}
          data={data}
          onClose={() => setEditorOpen(false)}
          onSave={(next: ScheduleData) => {
            save(next)
            setEditorOpen(false)
          }}
          onResetLocal={() => {
            resetToRepoTruth()
            window.location.reload()
          }}
        />
      ) : null}
    </div>
  )
}
