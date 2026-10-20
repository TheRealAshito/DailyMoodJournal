import { useI18n } from '../i18n'
import { useConstants } from '../contexts/ConstantsContext'

export default function MoodSlider({ value, onChange, disabled }) {
  const { t } = useI18n()
  const { mood_emojis: MOOD_EMOJIS } = useConstants()
  return (
    <div className="space-y-2">
      <label className="form-label">{t('mood')}</label>
      {/* Segmented track — active "thumb" uses the warm accent token */}
      <div className="flex items-center gap-1 bg-custom-secondary rounded-2xl p-1.5">
        {Object.entries(MOOD_EMOJIS).map(([i, emoji]) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(Number(i))}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              value === Number(i)
                ? 'bg-accent-soft scale-110'
                : 'hover:scale-105 opacity-60 hover:opacity-100'
            }`}
            style={value === Number(i) ? { boxShadow: '0 0 0 2px var(--accent)' } : undefined}
            title={`${i} — ${t(`mood_${i}`)}`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className={`text-xs ${value === Number(i) ? 'text-accent' : 'text-custom-muted'}`}>{t(`mood_${i}`)}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-custom-muted px-1">
        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
      </div>
    </div>
  )
}
