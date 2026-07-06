import { useI18n } from '../i18n'

const MOOD_EMOJIS = ['\u{1F61E}', '\u{1F622}', '\u{1F615}', '\u{1F610}', '\u{1F642}', '\u{1F60A}', '\u{1F929}']

export default function MoodSlider({ value, onChange, disabled }) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{t('mood')}</label>
      <div className="flex items-center gap-1">
        {MOOD_EMOJIS.map((emoji, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(i)}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
              value === i
                ? 'ring-2 ring-cyan-400 scale-110'
                : 'hover:scale-105 opacity-60 hover:opacity-100'
            }`}
            title={`${i} — ${t(`mood_${i}`)}`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs text-custom-muted">{t(`mood_${i}`)}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-custom-muted px-1">
        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
      </div>
    </div>
  )
}
