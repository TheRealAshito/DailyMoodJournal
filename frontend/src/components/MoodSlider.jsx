const MOOD_EMOJIS = ['\U0001f61e', '\U0001f622', '\U0001f615', '\U0001f610', '\U0001f642', '\U0001f60a', '\U0001f929']
const MOOD_LABELS = ['Terrible', 'Bad', 'Poor', 'Okay', 'Good', 'Great', 'Amazing']

export default function MoodSlider({ value, onChange, disabled }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Mood</label>
      <div className="flex items-center gap-1">
        {MOOD_EMOJIS.map((emoji, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(i)}
            className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
              value === i
                ? 'ring-2 ring-purple-500 scale-110'
                : 'hover:scale-105 opacity-60 hover:opacity-100'
            }`}
            title={`${i} — ${MOOD_LABELS[i]}`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs text-custom-muted">{MOOD_LABELS[i]}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-custom-muted px-1">
        <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
      </div>
    </div>
  )
}
