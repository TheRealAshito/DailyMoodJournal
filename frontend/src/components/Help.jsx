import { useI18n } from '../i18n'

const SECTIONS = [
  {
    id: 'getting-started',
    titleKey: 'help_sec_getting_started_title',
    introKey: 'help_gs_intro',
    bullets: [
      'help_gs_bullet_account',
      'help_gs_bullet_first',
      'help_gs_bullet_where',
      'help_gs_bullet_profile',
    ],
  },
  {
    id: 'journal',
    titleKey: 'help_sec_journal_title',
    introKey: 'help_journal_intro',
    bullets: [
      'help_journal_mood',
      'help_journal_text',
      'help_journal_tags',
      'help_journal_scales',
      'help_journal_prompts',
      'help_journal_edit',
      'help_journal_sticky',
    ],
  },
  {
    id: 'freewrite',
    titleKey: 'help_sec_freewrite_title',
    introKey: 'help_freewrite_intro',
    bullets: [
      'help_freewrite_sessions',
      'help_freewrite_autosave',
      'help_freewrite_words',
      'help_freewrite_export',
    ],
  },
  {
    id: 'insights',
    titleKey: 'help_sec_insights_title',
    introKey: 'help_insights_intro',
    bullets: [
      'help_insights_filters',
      'help_insights_charts',
      'help_insights_totals',
      'help_insights_pdf',
    ],
  },
  {
    id: 'trackers',
    titleKey: 'help_sec_trackers_title',
    introKey: 'help_trackers_intro',
    blocks: [
      { headingKey: 'help_trackers_timer_title', textKey: 'help_trackers_timer_text' },
      { headingKey: 'help_trackers_counter_title', textKey: 'help_trackers_counter_text' },
      { headingKey: 'help_trackers_patterns_title', textKey: 'help_trackers_patterns_text' },
    ],
  },
  {
    id: 'reminders',
    titleKey: 'help_sec_reminders_title',
    introKey: 'help_reminders_intro',
    bullets: [
      'help_reminders_banner',
      'help_reminders_ntfy',
      'help_reminders_privacy',
    ],
  },
  {
    id: 'privacy',
    titleKey: 'help_sec_privacy_title',
    introKey: 'help_privacy_intro',
    bullets: [
      'help_privacy_encryption',
      'help_privacy_offline',
      'help_privacy_devices',
      'help_privacy_pin',
      'help_privacy_reset',
      'help_privacy_backup',
    ],
  },
]

const DISTORTION_KEYS = Array.from({ length: 12 }, (_, i) => i)

function Section({ section, t }) {
  return (
    <section id={section.id} className="scroll-mt-6">
      <div className="card card-pad">
        <h2 className="section-title mb-3">{t(section.titleKey)}</h2>
        <p className="text-sm text-custom-muted leading-relaxed">{t(section.introKey)}</p>

        {section.bullets && (
          <ul className="mt-4 space-y-3">
            {section.bullets.map((key) => (
              <li key={key} className="flex gap-2.5">
                <span aria-hidden="true" className="text-accent select-none">•</span>
                <p className="text-sm text-custom-muted leading-relaxed">{t(key)}</p>
              </li>
            ))}
          </ul>
        )}

        {section.blocks && (
          <div className="mt-4 space-y-4">
            {section.blocks.map((block) => (
              <div key={block.headingKey} className="rounded-xl border border-custom bg-accent-soft/40 p-4">
                <h3 className="text-sm font-semibold text-custom mb-1.5">{t(block.headingKey)}</h3>
                <p className="text-sm text-custom-muted leading-relaxed">{t(block.textKey)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default function Help() {
  const { t } = useI18n()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="display text-2xl mb-2">{t('help_title')}</h1>
      <p className="text-custom-muted text-sm leading-relaxed">{t('help_intro')}</p>

      {/* Table of contents */}
      <nav aria-label={t('help_toc_title')} className="card card-pad mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-custom-muted mb-3">
          {t('help_toc_title')}
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="chip">
              {t(s.titleKey)}
            </a>
          ))}
          <a href="#cbt" className="chip">{t('help_sec_cbt_title')}</a>
        </div>
      </nav>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => (
          <Section key={s.id} section={s} t={t} />
        ))}

        {/* CBT (TCC) guide — merged from the former About CBT page */}
        <section id="cbt" className="scroll-mt-6">
          <div className="card card-pad">
            <h2 className="section-title mb-3">🧠 {t('help_sec_cbt_title')}</h2>
            <p className="text-sm text-custom-muted leading-relaxed">{t('help_cbt_intro')}</p>

            <div className="mt-4 rounded-xl border border-custom bg-accent-soft/40 p-4">
              <h3 className="text-sm font-semibold text-custom mb-1.5">{t('help_cbt_what_are')}</h3>
              <p className="text-sm text-custom-muted leading-relaxed">{t('help_cbt_desc_1')}</p>
              <p className="text-sm text-custom-muted leading-relaxed mt-2">{t('help_cbt_desc_2')}</p>
              <p className="text-sm text-custom-muted leading-relaxed mt-3">
                <strong className="text-custom">{t('help_cbt_cycle_title')}:</strong> {t('help_cbt_cycle')}
              </p>
            </div>

            <h3 className="text-sm font-semibold text-custom mt-6 mb-3">{t('help_cbt_distortions_title')}</h3>
            <div className="space-y-3">
              {DISTORTION_KEYS.map((i) => (
                <details key={i} className="rounded-xl border border-custom bg-custom-secondary/40 p-4 group">
                  <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between">
                    <span className="text-custom">{t(`help_cbt_${i}_name`)}</span>
                    <span aria-hidden="true" className="text-custom-muted text-xs group-open:hidden">+</span>
                    <span aria-hidden="true" className="text-custom-muted text-xs hidden group-open:block">−</span>
                  </summary>
                  <div className="mt-2 text-sm text-custom-muted">
                    <p className="leading-relaxed">{t(`help_cbt_${i}_desc`)}</p>
                    <p className="mt-2 italic leading-relaxed">
                      {t('help_cbt_example_label')} &ldquo;{t(`help_cbt_${i}_example`)}&rdquo;
                    </p>
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-custom bg-accent-soft/40 p-4">
              <p className="text-sm text-custom-muted leading-relaxed">{t('help_cbt_closing')}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="divider my-8" />
    </div>
  )
}
