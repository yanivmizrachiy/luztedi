import { useEffect, useMemo, useState } from 'react'

function formatHebrewDay(date: Date): string {
  const days = [
    'יום ראשון',
    'יום שני',
    'יום שלישי',
    'יום רביעי',
    'יום חמישי',
    'יום שישי',
    'יום שבת',
  ]
  return days[date.getDay()] ?? ''
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function DigitalClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const text = useMemo(() => {
    const day = formatHebrewDay(now)
    const d = pad2(now.getDate())
    const m = pad2(now.getMonth() + 1)
    const y = String(now.getFullYear())
    const hh = pad2(now.getHours())
    const mm = pad2(now.getMinutes())
    const ss = pad2(now.getSeconds())
    return `${day} · ${d}.${m}.${y} · ${hh}:${mm}:${ss}`
  }, [now])

  return (
    <div
      className="w-full rounded-2xl bg-white shadow-soft px-4 py-3"
      aria-label="שעון דיגיטלי"
    >
      <div className="text-center font-extrabold text-meeting-700 tracking-wide">
        <span className="text-[16px] sm:text-[18px]">{text}</span>
      </div>
    </div>
  )
}
