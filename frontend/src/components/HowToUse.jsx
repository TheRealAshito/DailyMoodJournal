import { useI18n } from '../i18n'

export default function HowToUse() {
  const { t } = useI18n()

  const sections = [
    { title: 'howto_intro', text: null, isIntro: true },
    { title: 'howto_entries_title', text: 'howto_entries_text' },
    { title: 'howto_scales_title', text: 'howto_scales_text' },
    { title: 'howto_tags_title', text: 'howto_tags_text' },
    { title: 'howto_calendar_title', text: 'howto_calendar_text' },
    { title: 'howto_export_title', text: 'howto_export_text' },
    { title: 'howto_settings_title', text: 'howto_settings_text' },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t('howto_title')}</h1>

      <div className="space-y-6">
        {sections.map((s) =>
          s.isIntro ? (
            <p key="intro" className="text-custom-muted text-sm leading-relaxed">{t(s.title)}</p>
          ) : (
            <div key={s.title} className="card-bg border border-custom rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-2">{t(s.title)}</h2>
              <p className="text-sm text-custom-muted leading-relaxed whitespace-pre-line">{t(s.text)}</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
