import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Monitor, Moon, Sun, WifiOff } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { Language, ThemePreference } from '@/domain/types';

/**
 * First-launch onboarding: language, theme, short explanation, demo-data
 * notice, offline note. No account / OTP / internet required, and the flow
 * is a single screen (not a long wizard).
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>(settings.language);
  const [theme, setTheme] = useState<ThemePreference>(settings.theme);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateSettings({ language, theme, onboardingComplete: true });
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
    { value: 'light', label: t('onboarding.themeLight'), Icon: Sun },
    { value: 'dark', label: t('onboarding.themeDark'), Icon: Moon },
    { value: 'system', label: t('onboarding.themeSystem'), Icon: Monitor },
  ];

  return (
    <div className="app-main" style={{ paddingBottom: 'var(--space-6)' }}>
      <div className="stack" style={{ maxWidth: 560, margin: '0 auto', gap: 'var(--space-5)' }}>
        <header style={{ textAlign: 'center', paddingTop: 'var(--space-5)' }}>
          <img
            src="/favicon.svg"
            alt=""
            width={72}
            height={72}
            style={{ margin: '0 auto var(--space-3)' }}
          />
          <h1>{t('onboarding.welcome')}</h1>
          <p className="muted" style={{ fontWeight: 600 }}>
            {t('common.tagline')}
          </p>
        </header>

        <section className="card">
          <h2 className="card__title">{t('onboarding.chooseLanguage')}</h2>
          <div className="segmented" role="group" aria-label={t('a11y.languageSelect')}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className="segmented__option"
                aria-pressed={language === lang.code}
                onClick={() => setLanguage(lang.code)}
              >
                {lang.code === 'kn'
                  ? lang.label
                  : lang.code === 'en'
                    ? t('onboarding.languageEnglish')
                    : lang.code === 'ta'
                      ? t('onboarding.languageTamil')
                      : t('onboarding.languageHindi')}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">{t('onboarding.chooseTheme')}</h2>
          <div className="segmented" role="group" aria-label={t('a11y.themeSelect')}>
            {themeOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className="segmented__option"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                <span className="row" style={{ justifyContent: 'center', gap: 6 }}>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="card stack stack--tight">
          <p>• {t('onboarding.explanation1')}</p>
          <p>• {t('onboarding.explanation2')}</p>
          <p>• {t('onboarding.explanation3')}</p>
          <p className="row text-sm" style={{ gap: 6, color: 'var(--color-text-muted)' }}>
            <WifiOff size={16} aria-hidden="true" />
            {t('onboarding.offlineNote')}
          </p>
        </section>

        <div className="alert alert--warning" role="note">
          <Check size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t('onboarding.demoNotice')}</span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--lg btn--block"
          onClick={start}
          disabled={busy}
        >
          {busy ? t('common.loading') : t('onboarding.startButton')}
        </button>

        <p className="text-xs muted" style={{ textAlign: 'center' }}>
          {t('common.rememberOffline')}
        </p>
      </div>
    </div>
  );
}

export default OnboardingScreen;
