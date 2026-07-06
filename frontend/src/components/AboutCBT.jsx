import { useI18n } from '../i18n'

const DISTORTION_KEYS = Array.from({ length: 12 }, (_, i) => i)

export default function AboutCBT() {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧠 {t('about_cbt')}</h1>

      <div className="card-bg border border-custom rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-3 text-lg">{t('cbt_what_are')}</h3>
        <p className="text-sm leading-relaxed text-custom-muted">{t('cbt_desc_1')}</p>
        <p className="text-sm leading-relaxed text-custom-muted mt-3">{t('cbt_desc_2')}</p>
        <div className="mt-4 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-sm">
          <strong>{t('cbt_cycle_title')}:</strong> {t('cbt_cycle')}
        </div>
      </div>

      <h3 className="font-semibold mb-4 text-lg">{t('cbt_12_distortions')}</h3>
      <div className="space-y-3">
        {DISTORTION_KEYS.map((i) => (
          <details key={i} className="card-bg border border-custom rounded-xl p-4 group">
            <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between">
              <span>{t(`cbt_${i}_name`)}</span>
              <span className="text-custom-muted text-xs group-open:hidden">▶</span>
              <span className="text-custom-muted text-xs hidden group-open:block">▼</span>
            </summary>
            <div className="mt-2 text-sm text-custom-muted">
              <p>{t(`cbt_${i}_desc`)}</p>
              <p className="mt-2 italic">Example: &ldquo;{t(`cbt_${i}_example`)}&rdquo;</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
