import { useState, useEffect, useMemo } from 'react'
import api from '../api'
import { useI18n } from '../i18n'

const INPUT_CLS = 'w-full px-3 py-2 rounded-lg border-custom bg-custom-secondary text-custom text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400'
const BTN_PRIMARY = 'px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600'
const BTN_NEUTRAL = 'px-3 py-1.5 rounded-lg text-sm font-medium border border-custom text-custom hover-bg transition-colors'
const BTN_DANGER = 'px-3 py-1.5 rounded-lg text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'

function pad(n) {
  return String(n).padStart(2, '0')
}

function splitElapsed(totalSeconds) {
  const total = Math.max(0, Math.floor(totalSeconds))
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

function isoToLocalInput(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return ''
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function localInputToIso(value) {
  if (!value) return ''
  const dt = new Date(value)
  if (isNaN(dt.getTime())) return ''
  return dt.toISOString()
}

function errDetail(err) {
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => (x && typeof x.msg === 'string' ? x.msg : '')).filter(Boolean).join('; ')
  return err.message || ''
}

function TimerCard({ tracker, onChange }) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tracker.name)
  const [lastDone, setLastDone] = useState(isoToLocalInput(tracker.last_done_at))
  const [note, setNote] = useState(tracker.note || '')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setName(tracker.name)
    setLastDone(isoToLocalInput(tracker.last_done_at))
    setNote(tracker.note || '')
    setEditing(false)
  }, [tracker])

  const startMs = tracker.last_done_at ? new Date(tracker.last_done_at).getTime() : NaN
  const elapsedSec = isNaN(startMs) ? 0 : Math.max(0, (now - startMs) / 1000)
  const e = splitElapsed(elapsedSec)
  const elapsedText = t('timer_elapsed_format', { d: e.d, h: pad(e.h), m: pad(e.m), s: pad(e.s) })

  let longestValue = '—'
  if (typeof tracker.longest_seconds === 'number' && isFinite(tracker.longest_seconds)) {
    const l = splitElapsed(tracker.longest_seconds)
    longestValue = t('timer_longest_format', { d: l.d, h: pad(l.h), m: pad(l.m) })
  }

  async function handleReset() {
    if (!window.confirm(t('reset_confirm'))) return
    setMsg('')
    try {
      await api.post(`/trackers/${tracker.id}/reset`, {})
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  async function handleSaveEdit(ev) {
    ev.preventDefault()
    setMsg('')
    const body = { name: name.trim() }
    const iso = localInputToIso(lastDone)
    if (iso) body.last_done_at = iso
    body.note = note.trim()
    try {
      await api.patch(`/trackers/${tracker.id}`, body)
      setEditing(false)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('delete_tracker_confirm'))) return
    setMsg('')
    try {
      await api.delete(`/trackers/${tracker.id}`)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  return (
    <div className="card-bg border border-custom rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-custom">{tracker.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditing(!editing)} className={BTN_NEUTRAL}>{t('edit')}</button>
          <button onClick={handleDelete} className={BTN_DANGER}>{t('delete')}</button>
        </div>
      </div>

      <div className="mt-3 text-center">
        <div className="text-4xl sm:text-5xl font-mono font-bold text-cyan-500 tabular-nums">{elapsedText}</div>
        <div className="mt-1 text-sm text-custom-muted">{t('timer_longest', { value: longestValue })}</div>
      </div>

      {tracker.note ? (
        <div className="mt-4 px-4 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-custom italic text-center">
          {tracker.note}
        </div>
      ) : null}

      {editing && (
        <form onSubmit={handleSaveEdit} className="mt-4 space-y-3 border-t border-custom pt-4">
          <div>
            <label className="block text-sm text-custom-muted mb-1">{t('tracker_name')}</label>
            <input type="text" value={name} onChange={(ev) => setName(ev.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm text-custom-muted mb-1">{t('tracker_last_done')}</label>
            <input type="datetime-local" value={lastDone} onChange={(ev) => setLastDone(ev.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-sm text-custom-muted mb-1">{t('tracker_note')}</label>
            <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} placeholder={t('tracker_note_placeholder')} className={INPUT_CLS} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY}>{t('save')}</button>
            <button type="button" onClick={() => setEditing(false)} className={BTN_NEUTRAL}>{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="mt-4 flex justify-center">
        <button onClick={handleReset} className={BTN_PRIMARY}>{t('i_did_it_again')}</button>
      </div>

      {msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}
    </div>
  )
}

function CounterCard({ tracker, onChange }) {
  const { t, locale } = useI18n()
  const [showLog, setShowLog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tracker.name)
  const [at, setAt] = useState('')
  const [doing, setDoing] = useState('')
  const [feeling, setFeeling] = useState('')
  const [mind, setMind] = useState('')
  const [triggers, setTriggers] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setName(tracker.name)
    setEditing(false)
  }, [tracker])

  const sortedEvents = useMemo(() => {
    return [...(tracker.events || [])].sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [tracker.events])

  const dayGroups = useMemo(() => {
    const map = new Map()
    for (const ev of sortedEvents) {
      const dt = new Date(ev.at)
      const key = isNaN(dt.getTime()) ? '' : dt.toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
    }
    return [...map.entries()]
  }, [sortedEvents])

  const perDay = useMemo(() => {
    return dayGroups.map(([key, evs]) => {
      const dt = new Date(evs[0].at)
      return { key, dt, count: evs.length }
    })
  }, [dayGroups])

  const triggerCounts = useMemo(() => {
    const counts = new Map()
    for (const ev of tracker.events || []) {
      if (!ev.triggers) continue
      for (const part of String(ev.triggers).split(/[,;\n]/)) {
        const k = part.trim().toLowerCase()
        if (!k) continue
        counts.set(k, (counts.get(k) || 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [tracker.events])

  function resetLogForm() {
    setAt('')
    setDoing('')
    setFeeling('')
    setMind('')
    setTriggers('')
  }

  async function handleLog(ev) {
    ev.preventDefault()
    setMsg('')
    const body = {}
    const iso = localInputToIso(at)
    if (iso) body.at = iso
    if (doing.trim()) body.doing = doing.trim()
    if (feeling.trim()) body.feeling = feeling.trim()
    if (mind.trim()) body.mind = mind.trim()
    if (triggers.trim()) body.triggers = triggers.trim()
    try {
      await api.post(`/trackers/${tracker.id}/events`, body)
      resetLogForm()
      setShowLog(false)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  async function handleSaveEdit(ev) {
    ev.preventDefault()
    setMsg('')
    try {
      await api.patch(`/trackers/${tracker.id}`, { name: name.trim() })
      setEditing(false)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  async function handleDeleteEvent(eventId) {
    if (!window.confirm(t('delete_event_confirm'))) return
    setMsg('')
    try {
      await api.delete(`/trackers/${tracker.id}/events/${eventId}`)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('delete_tracker_confirm'))) return
    setMsg('')
    try {
      await api.delete(`/trackers/${tracker.id}`)
      onChange()
    } catch (err) {
      setMsg(errDetail(err) || t('tracker_error'))
    }
  }

  return (
    <div className="card-bg border border-custom rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-custom">{tracker.name}</h3>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditing(!editing)} className={BTN_NEUTRAL}>{t('edit')}</button>
          <button onClick={handleDelete} className={BTN_DANGER}>{t('delete')}</button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="px-3 py-1.5 rounded-lg bg-custom-secondary border border-custom text-custom font-semibold tabular-nums">
          {t('counter_total', { count: tracker.event_count ?? 0 })}
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-custom-secondary border border-custom text-custom-muted tabular-nums">
          {t('counter_today', { count: tracker.today_count ?? 0 })}
        </span>
      </div>

      {editing && (
        <form onSubmit={handleSaveEdit} className="mt-4 space-y-3 border-t border-custom pt-4">
          <div>
            <label className="block text-sm text-custom-muted mb-1">{t('tracker_name')}</label>
            <input type="text" value={name} onChange={(ev) => setName(ev.target.value)} className={INPUT_CLS} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={BTN_PRIMARY}>{t('save')}</button>
            <button type="button" onClick={() => setEditing(false)} className={BTN_NEUTRAL}>{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {!showLog ? (
          <button onClick={() => setShowLog(true)} className={BTN_PRIMARY}>{t('log_occurrence')}</button>
        ) : (
          <form onSubmit={handleLog} className="space-y-3 border-t border-custom pt-4">
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('event_doing')}</label>
              <input type="text" value={doing} onChange={(ev) => setDoing(ev.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('event_feeling')}</label>
              <input type="text" value={feeling} onChange={(ev) => setFeeling(ev.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('event_mind')}</label>
              <input type="text" value={mind} onChange={(ev) => setMind(ev.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('event_triggers')}</label>
              <input type="text" value={triggers} onChange={(ev) => setTriggers(ev.target.value)} placeholder={t('event_triggers_placeholder')} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('event_when')}</label>
              <input type="datetime-local" value={at} onChange={(ev) => setAt(ev.target.value)} className={INPUT_CLS} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={BTN_PRIMARY}>{t('save')}</button>
              <button type="button" onClick={() => { setShowLog(false); resetLogForm() }} className={BTN_NEUTRAL}>{t('cancel')}</button>
            </div>
          </form>
        )}
      </div>

      {msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}

      {/* Events grouped by day */}
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-custom-muted uppercase tracking-wide">{t('events_title')}</h4>
        {sortedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-custom-muted">{t('no_events')}</p>
        ) : (
          <div className="mt-2 space-y-4">
            {dayGroups.map(([key, evs]) => (
              <div key={key || 'unknown'}>
                <div className="text-xs font-semibold text-custom-muted border-b border-custom pb-1">
                  {isNaN(new Date(evs[0].at).getTime())
                    ? ''
                    : new Date(evs[0].at).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-2 space-y-2">
                  {evs.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-custom-secondary border border-custom">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-custom-muted tabular-nums">
                          {isNaN(new Date(ev.at).getTime())
                            ? ''
                            : new Date(ev.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {ev.doing && (
                          <div className="text-sm text-custom"><span className="text-custom-muted">{t('event_doing')} </span>{ev.doing}</div>
                        )}
                        {ev.feeling && (
                          <div className="text-sm text-custom"><span className="text-custom-muted">{t('event_feeling')} </span>{ev.feeling}</div>
                        )}
                        {ev.mind && (
                          <div className="text-sm text-custom"><span className="text-custom-muted">{t('event_mind')} </span>{ev.mind}</div>
                        )}
                        {ev.triggers && (
                          <div className="text-sm text-custom"><span className="text-custom-muted">{t('event_triggers')} </span>{ev.triggers}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        title={t('delete')}
                        aria-label={t('delete')}
                        className="shrink-0 w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patterns */}
      {(perDay.length > 0 || triggerCounts.length > 0) && (
        <div className="mt-5 border-t border-custom pt-4">
          <h4 className="text-sm font-semibold text-custom-muted uppercase tracking-wide">{t('patterns_title')}</h4>
          {perDay.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-custom-muted">{t('patterns_per_day')}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-custom tabular-nums">
                {perDay.map((d) => (
                  <span key={d.key}>
                    {isNaN(d.dt.getTime())
                      ? '—'
                      : d.dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    : {d.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {triggerCounts.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-custom-muted">{t('patterns_triggers')}</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {triggerCounts.map(([trg, count]) => (
                  <span key={trg} className="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 border border-cyan-500/30 text-custom">
                    {trg} ×{count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Trackers() {
  const { t } = useI18n()
  const [trackers, setTrackers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('timer')
  const [lastDone, setLastDone] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  async function refresh() {
    try {
      const r = await api.get('/trackers')
      setTrackers(r.data?.trackers || [])
    } catch {
      setTrackers([])
    }
    setLoaded(true)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(ev) {
    ev.preventDefault()
    setErr('')
    const body = { name: name.trim(), type }
    if (type === 'timer') {
      const iso = localInputToIso(lastDone)
      if (iso) body.last_done_at = iso
      if (note.trim()) body.note = note.trim()
    }
    try {
      await api.post('/trackers', body)
      setName('')
      setLastDone('')
      setNote('')
      refresh()
    } catch (error) {
      setErr(errDetail(error) || t('tracker_error'))
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-custom mb-6">{t('trackers')}</h2>

      {/* New tracker form */}
      <form onSubmit={handleCreate} className="card-bg border border-custom rounded-xl p-5 mb-6 space-y-4">
        <h3 className="text-lg font-semibold text-custom">{t('new_tracker')}</h3>
        <div>
          <label className="block text-sm text-custom-muted mb-1">{t('tracker_name')}</label>
          <input
            type="text"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            placeholder={t('tracker_name_placeholder')}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-sm text-custom-muted mb-1">{t('tracker_type')}</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('timer')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'timer' ? 'bg-cyan-500 text-white' : 'border-custom bg-custom-secondary text-custom'}`}
            >
              {t('type_timer')}
            </button>
            <button
              type="button"
              onClick={() => setType('counter')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'counter' ? 'bg-cyan-500 text-white' : 'border-custom bg-custom-secondary text-custom'}`}
            >
              {t('type_counter')}
            </button>
          </div>
        </div>
        {type === 'timer' && (
          <>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('tracker_last_done')}</label>
              <input type="datetime-local" value={lastDone} onChange={(ev) => setLastDone(ev.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm text-custom-muted mb-1">{t('tracker_note')}</label>
              <textarea
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                rows={2}
                placeholder={t('tracker_note_placeholder')}
                className={INPUT_CLS}
              />
            </div>
          </>
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <button type="submit" className={BTN_PRIMARY}>{t('create_tracker')}</button>
      </form>

      {/* Tracker list */}
      {loaded && trackers.length === 0 ? (
        <div className="card-bg border border-custom rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-custom-muted">{t('no_trackers')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trackers.map((tracker) =>
            tracker.type === 'timer' ? (
              <TimerCard key={tracker.id} tracker={tracker} onChange={refresh} />
            ) : (
              <CounterCard key={tracker.id} tracker={tracker} onChange={refresh} />
            )
          )}
        </div>
      )}
    </div>
  )
}
