import { SITE_TITLE } from '../theme'
import { DigitalClock } from './DigitalClock'

export function Header(props: { below?: React.ReactNode }) {
  const { below } = props
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/75 shadow-soft">
      <div className="mx-auto max-w-md px-4 pt-4 pb-3">
        <h1 className="text-center text-[18px] font-extrabold leading-snug tracking-wide text-ink-950 drop-shadow-sm">
          {SITE_TITLE}
        </h1>
        <div className="mt-1 text-center text-[18px] font-extrabold tracking-wide text-amber-500 drop-shadow-sm">
          לו"ז מחצית ב' חטיבת הביניים
        </div>
        <div className="mt-3">
          <DigitalClock />
        </div>
      </div>
      {below}
      <div className="h-px w-full bg-black/5" />
    </header>
  )
}
