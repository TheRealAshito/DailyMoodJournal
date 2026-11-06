import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'

/* ------------------------------------------------------------
   Relaxation — live breathing pacer + interactive stress tools.
   The breathing circle scales with each breath phase via inline
   transform + CSS transition, so it runs natively in any browser
   and respects prefers-reduced-motion (phase text keeps ticking).
   Each quick tool opens a focused overlay panel with its own
   guided experience (fill-in grounding wizard, physiological
   sigh pacer, animated muscle-relaxation sequence). All tool
   state is ephemeral — nothing is ever persisted.
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
  { id: 'sigh', titleKey: 'relax_sigh_title', bodyKey: 'relax_sigh_body' },
  { id: 'ground', titleKey: 'relax_ground_title', bodyKey: 'relax_ground_body' },
  { id: 'pmr', titleKey: 'relax_pmr_title', bodyKey: 'relax_pmr_body' },
]

/* ---- Physiological sigh: inhale, top-up, long exhale ---- */
const SIGH_PHASES = [
  { key: 'relax_sigh_inhale', dur: 1.5, scale: 0.95 },
  { key: 'relax_sigh_topup', dur: 1, scale: 1 },
  { key: 'relax_sigh_exhale', dur: 6, scale: 0.7 },
]
const SIGH_REPS = 3
const SIGH_IDLE = 0.7

/* ---- 5-4-3-2-1 grounding wizard ---- */
const GROUND_STEPS = [
  { key: 'relax_ground_see', count: 5 },
  { key: 'relax_ground_touch', count: 4 },
  { key: 'relax_ground_hear', count: 3 },
  { key: 'relax_ground_smell', count: 2 },
  { key: 'relax_ground_taste', count: 1 },
]

/* ---- Progressive muscle relaxation ---- */
const PMR_ZONES = [
  { id: 'feet', key: 'relax_pmr_zone_feet' },
  { id: 'calves', key: 'relax_pmr_zone_calves' },
  { id: 'thighs', key: 'relax_pmr_zone_thighs' },
  { id: 'belly', key: 'relax_pmr_zone_belly' },
  { id: 'hands', key: 'relax_pmr_zone_hands' },
  { id: 'arms', key: 'relax_pmr_zone_arms' },
  { id: 'shoulders', key: 'relax_pmr_zone_shoulders' },
  { id: 'neck', key: 'relax_pmr_zone_neck' },
  { id: 'face', key: 'relax_pmr_zone_face' },
]
const PMR_TENSE_DUR = 5
const PMR_RELEASE_DUR = 30

/* ============================================================
   Shared overlay shell: translucent backdrop, centered card,
   top-right close, Escape to dismiss, body scroll lock.
   ============================================================ */
function ToolPanel({ titleKey, onClose, children }) {
  const { t } = useI18n()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'color-mix(in srgb, var(--bg) 55%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
        className="card card-pad fade-up relative w-full max-w-lg"
        style={{ maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="section-title" style={{ marginTop: '0.2rem' }}>
            {t(titleKey)}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t('relax_close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ============================================================
   1) Grounding — 5-4-3-2-1 fill-in wizard.
   Values live in component state only (privacy: ephemeral).
   ============================================================ */
function GroundingWizard({ onClose }) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [values, setValues] = useState(() =>
    GROUND_STEPS.map((s) => Array(s.count).fill(''))
  )

  const setValue = (slot, v) =>
    setValues((prev) =>
      prev.map((arr, si) =>
        si === step ? arr.map((x, xi) => (xi === slot ? v : x)) : arr
      )
    )

  const restart = () => {
    setValues(GROUND_STEPS.map((s) => Array(s.count).fill('')))
    setStep(0)
    setDone(false)
  }

  if (done) {
    return (
      <div className="fade-up text-center py-6">
        <p className="display text-lg mb-5">{t('relax_ground_done_msg')}</p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={restart}>
            {t('relax_start_over')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('relax_close')}
          </button>
        </div>
      </div>
    )
  }

  const current = GROUND_STEPS[step]
  const isLast = step === GROUND_STEPS.length - 1

  return (
    <div>
      {/* Progress: five dots + counter */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {GROUND_STEPS.map((s, si) => (
          <span
            key={s.key}
            aria-hidden="true"
            className="rounded-full"
            style={{
              width: '8px',
              height: '8px',
              backgroundColor:
                si < step ? 'var(--accent)' : si === step ? 'var(--accent)' : 'var(--border)',
              opacity: si < step ? 0.55 : 1,
              boxShadow:
                si === step ? '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)' : 'none',
              transition: 'background-color 0.25s ease',
            }}
          />
        ))}
        <span className="text-custom-muted" style={{ fontSize: '0.8125rem', marginLeft: '0.35rem' }}>
          {step + 1} / {GROUND_STEPS.length}
        </span>
      </div>

      {/* Step content (re-keyed per step so fade-up replays) */}
      <div key={step} className="fade-up">
        <h3 className="display text-lg mb-4">{t(current.key)}</h3>
        <div className="grid gap-2.5">
          {values[step].map((v, slot) => (
              <input
                key={`${current.key}-${slot}`}
                type="text"
                className="input"
                value={v}
                placeholder={t('relax_ground_placeholder')}
                aria-label={`${t(current.key)} — ${slot + 1}`}
                onChange={(e) => setValue(slot, e.target.value)}
              />
            ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          {t('relax_back')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (isLast ? setDone(true) : setStep((s) => s + 1))}
        >
          {t('relax_next')}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   2) Physiological sigh — its own breathing circle.
   Same inline transform + per-phase transition technique as the
   main pacer; loops with a rep counter (3 per set).
   ============================================================ */
function SighPacer({ reducedMotion }) {
  const { t } = useI18n()
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [rep, setRep] = useState(1)
  const [remaining, setRemaining] = useState(SIGH_PHASES[0].dur)

  const phase = SIGH_PHASES[phaseIdx]

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
      const next = (phaseIdx + 1) % SIGH_PHASES.length
      if (next === 0) setRep((r) => (r % SIGH_REPS) + 1)
      setPhaseIdx(next)
    }, phase.dur * 1000)
    return () => {
      clearTimeout(timer)
      clearInterval(tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIdx])

  const reset = () => {
    setRunning(false)
    setPhaseIdx(0)
    setRep(1)
    setRemaining(SIGH_PHASES[0].dur)
  }

  const targetScale = running ? phase.scale : SIGH_IDLE
  const circleTransition = reducedMotion
    ? 'none'
    : running
      ? `transform ${phase.dur}s ease-in-out`
      : 'transform 1.2s ease-in-out'

  return (
    <div className="flex flex-col items-center">
      {/* Compact breathing circle */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 'clamp(180px, 48vw, 230px)', height: 'clamp(180px, 48vw, 230px)' }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))' }}
        />
        <div
          role="img"
          aria-label={`${t(phase.key)} — ${t('relax_sigh_title')}`}
          className="rounded-full flex flex-col items-center justify-center text-center px-5"
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${targetScale})`,
            transition: circleTransition,
            background:
              'radial-gradient(circle at 50% 42%, var(--accent-soft), color-mix(in srgb, var(--accent) 22%, var(--accent-soft)))',
            border: '1px solid color-mix(in srgb, var(--accent) 32%, var(--border))',
            boxShadow: '0 0 50px color-mix(in srgb, var(--accent) 18%, transparent)',
          }}
        >
          <div
            className="display"
            style={{ fontSize: 'clamp(0.95rem, 3.8vw, 1.2rem)', color: 'var(--accent-strong)' }}
          >
            {t(phase.key)}
          </div>
          <div className="text-custom-muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {remaining}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-5">
        <button type="button" className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? t('relax_pause') : t('relax_start')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          {t('relax_reset')}
        </button>
      </div>

      {/* Rep counter */}
      <div className="mt-3">
        <span className="badge">
          {rep} / {SIGH_REPS} {t('relax_sigh_reps')}
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   3) Progressive muscle relaxation — guided sequence with an
   animated body silhouette highlighting the active zone.
   ============================================================ */
function BodyFigure({ activeZone, zoneLabel }) {
  const paint = (z) => ({
    fill: z === activeZone ? 'var(--accent-soft)' : 'transparent',
    stroke: z === activeZone ? 'var(--accent)' : 'var(--border)',
    strokeWidth: z === activeZone ? 2.2 : 1.5,
    transition: 'fill 0.45s ease, stroke 0.45s ease',
  })

  return (
    <svg
      viewBox="0 0 120 216"
      height="210"
      role="img"
      aria-label={zoneLabel}
      style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
    >
      {/* face */}
      <circle cx="60" cy="22" r="14" style={paint('face')} />
      {/* neck */}
      <rect x="53" y="35" width="14" height="9" rx="4" style={paint('neck')} />
      {/* shoulders */}
      <rect x="32" y="44" width="56" height="13" rx="6.5" style={paint('shoulders')} />
      {/* arms */}
      <rect x="18" y="50" width="12" height="52" rx="6" style={paint('arms')} />
      <rect x="90" y="50" width="12" height="52" rx="6" style={paint('arms')} />
      {/* belly / torso */}
      <rect x="38" y="57" width="44" height="54" rx="12" style={paint('belly')} />
      {/* hands */}
      <circle cx="24" cy="110" r="7" style={paint('hands')} />
      <circle cx="96" cy="110" r="7" style={paint('hands')} />
      {/* thighs */}
      <rect x="40" y="111" width="17" height="42" rx="8.5" style={paint('thighs')} />
      <rect x="63" y="111" width="17" height="42" rx="8.5" style={paint('thighs')} />
      {/* calves */}
      <rect x="41.5" y="157" width="14" height="34" rx="7" style={paint('calves')} />
      <rect x="64.5" y="157" width="14" height="34" rx="7" style={paint('calves')} />
      {/* feet */}
      <rect x="38" y="195" width="18" height="11" rx="5.5" style={paint('feet')} />
      <rect x="64" y="195" width="18" height="11" rx="5.5" style={paint('feet')} />
    </svg>
  )
}

function PmrSequence({ onClose, reducedMotion }) {
  const { t } = useI18n()
  const [zoneIdx, setZoneIdx] = useState(0)
  const [phase, setPhase] = useState('tense') // 'tense' | 'release'
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(PMR_TENSE_DUR)
  const [done, setDone] = useState(false)

  // Countdown tick; cleared on pause, completion and unmount.
  useEffect(() => {
    if (!running || done) return undefined
    const iv = setInterval(() => {
      setRemaining((r) => Math.max(0, Math.round((r - 0.25) * 100) / 100))
    }, 250)
    return () => clearInterval(iv)
  }, [running, done])

  // Auto-advance when a phase runs out.
  useEffect(() => {
    if (!running || done || remaining > 0) return
    if (phase === 'tense') {
      setPhase('release')
      setRemaining(PMR_RELEASE_DUR)
    } else if (zoneIdx < PMR_ZONES.length - 1) {
      setZoneIdx((z) => z + 1)
      setPhase('tense')
      setRemaining(PMR_TENSE_DUR)
    } else {
      setDone(true)
      setRunning(false)
    }
  }, [remaining, running, done, phase, zoneIdx])

  const skip = () => {
    if (zoneIdx < PMR_ZONES.length - 1) {
      setZoneIdx((z) => z + 1)
      setPhase('tense')
      setRemaining(PMR_TENSE_DUR)
    } else {
      setDone(true)
      setRunning(false)
    }
  }

  const reset = () => {
    setRunning(false)
    setZoneIdx(0)
    setPhase('tense')
    setRemaining(PMR_TENSE_DUR)
    setDone(false)
  }

  if (done) {
    return (
      <div className="fade-up text-center py-6">
        <p className="display text-lg mb-5">{t('relax_ground_done_msg')}</p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={reset}>
            {t('relax_start_over')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('relax_close')}
          </button>
        </div>
      </div>
    )
  }

  const zone = PMR_ZONES[zoneIdx]
  const phaseDur = phase === 'tense' ? PMR_TENSE_DUR : PMR_RELEASE_DUR
  const pct = Math.max(0, Math.min(100, (remaining / phaseDur) * 100))

  return (
    <div className="flex flex-col items-center">
      <BodyFigure activeZone={zone.id} zoneLabel={t(zone.key)} />

      {/* Zone + phase */}
      <div className="text-center mt-5">
        <div className="display text-lg">{t(zone.key)}</div>
        <div
          className="text-accent"
          style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '0.15rem' }}
        >
          {t(phase === 'tense' ? 'relax_pmr_tense' : 'relax_pmr_release')}
        </div>
      </div>

      {/* Slim progress bar + countdown */}
      <div className="w-full mt-4">
        <div className="w-full rounded-full bg-custom-secondary" style={{ height: '6px' }}>
          <div
            className="rounded-full"
            style={{
              height: '100%',
              width: `${pct}%`,
              backgroundColor: 'var(--accent)',
              transition: reducedMotion ? 'none' : 'width 0.25s linear',
            }}
          />
        </div>
        <div className="text-center mt-2">
          <span className="badge">{Math.ceil(remaining)}s</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
        <button type="button" className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? t('relax_pause') : t('relax_start')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={skip}>
          {t('relax_skip')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset}>
          {t('relax_reset')}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   Page
   ============================================================ */
export default function Relaxation() {
  const { t } = useI18n()

  const [patternId, setPatternId] = useState('box')
  const [running, setRunning] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [cycles, setCycles] = useState(0)
  const [remaining, setRemaining] = useState(PATTERNS.box.phases[0].dur)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [openTool, setOpenTool] = useState(null)

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

      {/* Quick tools — each card opens its guided experience */}
      <section className="fade-up">
        <h2 className="section-title mb-3">{t('relax_tools')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setOpenTool(tool.id)}
              className="card card-hover card-pad text-left"
              style={{ cursor: 'pointer' }}
            >
              <h3 className="font-semibold mb-1 flex items-center justify-between gap-2">
                {t(tool.titleKey)}
                <span className="text-accent" aria-hidden="true">→</span>
              </h3>
              <p className="text-custom-muted" style={{ fontSize: '0.875rem' }}>
                {t(tool.bodyKey)}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Interactive tool overlays — one at a time */}
      {openTool === 'sigh' && (
        <ToolPanel titleKey="relax_sigh_title" onClose={() => setOpenTool(null)}>
          <SighPacer reducedMotion={reducedMotion} />
        </ToolPanel>
      )}
      {openTool === 'ground' && (
        <ToolPanel titleKey="relax_ground_title" onClose={() => setOpenTool(null)}>
          <GroundingWizard onClose={() => setOpenTool(null)} />
        </ToolPanel>
      )}
      {openTool === 'pmr' && (
        <ToolPanel titleKey="relax_pmr_title" onClose={() => setOpenTool(null)}>
          <PmrSequence onClose={() => setOpenTool(null)} reducedMotion={reducedMotion} />
        </ToolPanel>
      )}
    </div>
  )
}
