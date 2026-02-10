import { useEffect, useState } from 'react'
import type { ScheduleData } from './types'
import {
  loadScheduleFromRepo,
} from './lib/githubSync'
import { Header } from './components/Header'
import { DailyPage } from './pages/DailyPage'

const EMPTY: ScheduleData = { version: 1, schedule: [], exams: [], holidays: [] }

export default function App() {
  const [data, setData] = useState<ScheduleData>(EMPTY)
  const [loadingError, setLoadingError] = useState<string | null>(null)

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

  return (
    <div className="min-h-dvh bg-sky-400 bg-[url('/clouds.svg')] bg-repeat-x bg-top">
      <Header />

      {loadingError ? (
        <div className="mx-auto max-w-md px-4 py-4">
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-extrabold text-red-700">
            {loadingError}
          </div>
        </div>
      ) : null}

      <DailyPage data={data} />
    </div>
  )
}
