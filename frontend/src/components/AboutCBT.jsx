import { useI18n } from '../i18n'

const DISTORTIONS = [
  { name: 'Catastrophizing', desc: 'Expecting the worst-case scenario to happen, even when there is little evidence. You blow things out of proportion.', example: '"I made a mistake — my boss probably thinks I\'m incompetent."' },
  { name: 'Black-and-White Thinking', desc: 'Seeing situations in only two categories instead of on a spectrum. Things are either perfect or a total failure.', example: '"If I don\'t get an A, I\'m a complete failure."' },
  { name: 'Overgeneralization', desc: 'Taking a single negative event and seeing it as a never-ending pattern of defeat.', example: '"I didn\'t get a reply — nobody ever wants to talk to me."' },
  { name: 'Mental Filtering', desc: 'Dwelling exclusively on one negative detail while ignoring all the positive aspects.', example: '"Nine positive comments and one suggestion — and I can\'t stop thinking about that one."' },
  { name: 'Mind Reading', desc: 'Assuming you know what others are thinking about you, usually negatively, without evidence.', example: '"My friend didn\'t wave back — she must be angry with me."' },
  { name: 'Fortune Telling', desc: 'Predicting a negative outcome will happen and treating that prediction as an established fact.', example: '"I\'m going to embarrass myself, so there\'s no point in going."' },
  { name: 'Emotional Reasoning', desc: 'Believing that because you feel a certain way, it must be true.', example: '"I feel guilty, so I must have done something wrong."' },
  { name: 'Labeling', desc: 'Attaching a global, negative label to yourself or others based on a single event.', example: '"I forgot to call my mom — I\'m a terrible son."' },
  { name: 'Personalization', desc: 'Taking responsibility for events not entirely under your control, or blaming yourself.', example: '"My child is struggling — I must be a bad parent."' },
  { name: '"Should" Statements', desc: 'Holding yourself to rigid rules about how you or others "should" behave.', example: '"I should be more productive. I must not waste time."' },
  { name: 'Disqualifying the Positive', desc: 'Rejecting positive experiences by insisting they don\'t count.', example: '"They only said they liked it because they\'re being nice."' },
  { name: 'Magnification & Minimization', desc: 'Exaggerating the negative and shrinking the positive.', example: '"One wrong answer proves I\'m bad at math. The other 19 right don\'t count."' },
]

export default function AboutCBT() {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-6">🧠 {t('about_cbt')}</h1>

      <div className="card-bg border border-custom rounded-xl p-5 mb-6">
        <h3 className="font-semibold mb-3">What are Cognitive Distortions?</h3>
        <p className="text-sm text-custom-muted leading-relaxed">
          Cognitive distortions are exaggerated or irrational thought patterns that can reinforce negative thinking and emotions.
          They were first identified by Dr. Aaron Beck and popularized by Dr. David Burns in the context of
          Cognitive Behavioral Therapy (CBT).
        </p>
        <p className="text-sm text-custom-muted leading-relaxed mt-2">
          Everyone experiences them. The goal is not to eliminate them — it is to <strong>notice them, name them, and challenge them</strong>.
          By bringing awareness to your thinking patterns, you can gradually shift toward more balanced, realistic perspectives.
        </p>
        <div className="mt-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-sm">
          <strong>The CBT Cycle:</strong> Thoughts → Feelings → Behaviors → (reinforces) Thoughts
        </div>
      </div>

      <h3 className="font-semibold mb-4">The 12 Common Cognitive Distortions</h3>
      <div className="space-y-3">
        {DISTORTIONS.map((d) => (
          <details key={d.name} className="card-bg border border-custom rounded-xl p-4 group">
            <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between">
              <span>{d.name}</span>
              <span className="text-custom-muted text-xs group-open:hidden">▶</span>
              <span className="text-custom-muted text-xs hidden group-open:block">▼</span>
            </summary>
            <div className="mt-2 text-sm text-custom-muted">
              <p>{d.desc}</p>
              <p className="mt-2 italic">Example: &ldquo;{d.example}&rdquo;</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
