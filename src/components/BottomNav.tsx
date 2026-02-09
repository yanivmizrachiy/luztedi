export type TabKey = 'daily' | 'exams' | 'holidays'

export function BottomNav(props: {
  active: TabKey
  onChange: (tab: TabKey) => void
}) {
  const { active, onChange } = props

  const base =
    'flex-1 rounded-2xl px-3 py-3 text-[14px] font-bold transition active:scale-[0.98] focus-visible:outline-none'
  const on = 'bg-ink-950 text-white'
  const off = 'bg-white text-ink-950 shadow-soft'

  return (
    <nav
      className="sticky bottom-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      aria-label="ניווט תחתון"
    >
      <div className="mx-auto max-w-md px-4 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            className={`${base} ${active === 'daily' ? on : off}`}
            onClick={() => onChange('daily')}
            aria-label="לוז יומי"
          >
            לוז יומי
          </button>
          <button
            type="button"
            className={`${base} ${active === 'exams' ? on : off}`}
            onClick={() => onChange('exams')}
            aria-label="לוח מבחנים"
          >
            לוח מבחנים
          </button>
          <button
            type="button"
            className={`${base} ${active === 'holidays' ? on : off}`}
            onClick={() => onChange('holidays')}
            aria-label="לוח חופשות"
          >
            לוח חופשות
          </button>
        </div>
      </div>
    </nav>
  )
}
