import { SITE_TITLE } from '../theme'
import { DigitalClock } from './DigitalClock'

export function Header(props: { below?: React.ReactNode }) {
  const { below } = props
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/75">
      <div className="mx-auto max-w-md px-4 pt-4 pb-3">
        <h1 className="text-center text-[15px] font-extrabold leading-snug text-ink-950">
          {SITE_TITLE}
        </h1>
        <div className="mt-3">
          <DigitalClock />
        </div>
      </div>
      {below}
      <div className="h-px w-full bg-black/5" />
    </header>
  )
}
