import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

/* ------------------------------------------------------------
   Relaxation — live breathing pacer + quick stress tools.
   The breathing circle scales with each breath phase via inline
   transform + CSS transition, so it runs natively in any browser
   and respects prefers-reduced-motion (phase text keeps ticking).
   ------------------------------------------------------------ */

const PATTERNS = {
  box: {
    labelKey: 'relax_pattern_box',
    phases: [
      { key: 'relax_inhale', dur: 4, scale: 1 },
      { key: 'relax_hold', dur: 4, scale: 1 },
      { key: 'relax_exhale', dur: 4, scale: 0.72 },
      { key: 'relax_rest', dur: 4, scale: 0.72 },
    ],
  },
  '478': {
    labelKey: 'relax_pattern_478',
    phases: [
      { key: 'relax_inhale', dur: 4, scale: 1 },
      { key: 'relax_hold', dur: 7, scale: 1 },
      { key: 'relax_exhale', dur: 8, scale: 0.72 },
    ],
  },
  calm: {
    labelKey: 'relax_pattern_calm',
    phases: [
      { key: 'relax_inhale', dur: 4, scale: 1 },
      { key: 'relax_exhale', dur: 6, scale: 0.72 },
    ],
  },
}

const PATTERN_IDS = ['box', '478', 'calm']
const IDLE_SCALE = 0.85

const TOOLS = [
  { titleKey: 'relax_sigh_title', bodyKey: 'relax_sigh_body' },
  { titleKey: 'relax_ground_title', bodyKey: 'relax_ground_body' },
  { titleKey: 'relax_pmr_title', bodyKey: 'relax_pmr_body' },
]

export default function Relaxation() {
  const { t } = useI18n()

  const [patternId, setPatternId] = useState('box')
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [remaining, setRemaining] = useState(PATTERNS.box.phases[0].dur)
  const [reducedMotion, setReducedMotion] = useState(false)

  const pattern = PATTERNS[patternId]
  const phase = pattern.phases[phaseIdx]

  // Respect prefers-reduced-motion, live if the user toggles it.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Phase engine: schedule the next phase while running; cleaned up
  // on every phase change, on pause and on unmount.
  useEffect(() => {
    if (!running) return undefined
    const deadline = Date.now() + phase.dur * 1000
    setRemaining(phase.dur)
    const tick = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }, 250)
    const timer = setTimeout(() => {
      const next = (phaseIdx + 1) % pattern.phases.length
      if (next === 0) setCycles((c) => c + 1)
      setPhaseIdx(next)
    }, phase.dur * 1000)
    return () => {
      clearTimeout(timer)
      clearInterval(tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, patternId, phaseIdx])

  const selectPattern = (id) => {
    setPatternId(id)
    setPhaseIdx(0)
    setRemaining(PATTERNS[id].phases[0].dur)
  }

  const reset = () => {
    setRunning(false)
    setPhaseIdx(0)
    setCycles(0)
    setRemaining(pattern.phases[0].dur)
  }

  const targetScale = running ? phase.scale : IDLE_SCALE
  const circleTransition = reducedMotion
    ? 'none'
    : running
      ? `transform ${phase.dur}s ease-in-out`
      : 'transform 1.2s ease-in-out'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <header className="fade-up mb-6">
        <h1 className="display text-2xl mb-1">{t('relax_title')}</h1>
        <p className="text-custom-muted">{t('relax_intro')}</p>
      </header>

      {/* Breathing pacer */}
      <section className="card card-pad fade-up mb-8">
        <h2 className="section-title mb-3">{t('relax_breathing')}</h2>

        {/* Pattern chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {PATTERN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectPattern(id)}
              className={`chip${patternId === id ? ' chip-active' : ''}`}
              aria-pressed={patternId === id}
            >
              {t(PATTERNS[id].labelKey)}
            </button>
          ))}
        </div>

        {/* The breathing circle */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center" style={{ width: 'clamp(220px, 58vw, 300px)', height: 'clamp(220px, 58vw, 300px)' }}>
            {/* Soft halo ring */}
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{
                border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
              }}
            />
            {/* Breath circle */}
            <div
              role="img"
              aria-label={`${t(phase.key)} — ${t('relax_breathing')}`}
              className="rounded-full flex flex-col items-center justify-center text-center px-6"
              style={{
                width: '100%',
                height: '100%',
                transform: `scale(${targetScale})`,
                transition: circleTransition,
                background:
                  'radial-gradient(circle at 50% 42%, var(--accent-soft), color-mix(in srgb, var(--accent) 22%, var(--accent-soft)))',
                border: '1px solid color-mix(in srgb, var(--accent) 32%, var(--border))',
                boxShadow: '0 0 60px color-mix(in srgb, var(--accent) 20%, transparent)',
              }}
            >
              <div
                className="display"
                style={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.5rem)', color: 'var(--accent-strong)' }}
              >
                {t(phase.key)}
              </div>
              <div className="text-custom-muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                {remaining}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setRunning((r) => !r)}
            >
              {running ? t('relax_pause') : t('relax_start')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              {t('relax_reset')}
            </button>
          </div>

          {/* Cycles */}
          <div className="mt-3">
            <span className="badge">
              {cycles} {t('relax_cycles')}
            </span>
          </div>
        </div>
      </section>

      {/* Quick tools */}
      <section className="fade-up">
        <h2 className="section-title mb-3">{t('relax_tools')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <article key={tool.titleKey} className="card card-hover card-pad">
              <h3 className="font-semibold mb-1">{t(tool.titleKey)}</h3>
              <p className="text-custom-muted" style={{ fontSize: '0.875rem' }}>
                {t(tool.bodyKey)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
