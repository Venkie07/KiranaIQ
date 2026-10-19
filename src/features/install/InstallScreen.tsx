import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PageHeader } from '@/components/common/Badges';
import { OfflineBanner } from '@/components/feedback/ConnectionStatus';
import { useServiceWorkerUpdate } from '@/hooks/useServiceWorkerUpdate';

export function InstallScreen() {
  const { t } = useTranslation();
  const { state, isStandalone, promptInstall, error } = useInstallPrompt();
  const { updateReady, applyUpdate } = useServiceWorkerUpdate();

  if (updateReady && applyUpdate) {
    return (
      <div className="app-main">
        <PageHeader title={t('install.updateTitle')} />
        <div className="card stack" role="alert">
          <p>{t('install.updateBody')}</p>
          <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn--primary btn--block" onClick={applyUpdate}>
              {t('install.updateAction')}
            </button>
            <button type="button" className="btn btn--secondary btn--block" onClick={() => window.location.reload()}>
              {t('common.dismiss')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <PageHeader title={t('install.title')} />
      <OfflineBanner />

      <section className="card section" aria-labelledby="install-heading">
        <h2 id="install-heading" className="card__title">{t('install.whatIsPwa')}</h2>

        {isStandalone ? (
          <div className="alert alert--success" role="status">
            <p>{t('install.alreadyInstalled')}</p>
          </div>
        ) : state === 'available' ? (
          <div className="stack">
            <p>{t('install.whatIsPwa')}</p>
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={promptInstall}
              disabled={promptInstall === undefined}
            >
              {t('install.installButton')}
            </button>
          </div>
        ) : (
          <p>{t('install.installPromptUnavailable')}</p>
        )}

        {state === 'dismissed' && (
          <p className="muted text-sm">{t('install.noPrompt')}</p>
        )}

        {error && <div className="alert alert--error">{t(error)}</div>}
      </section>

      <section className="card section" aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="card__title">{t('install.stepsChromeTitle')}</h2>
        <ol className="stack stack--tight" style={{ paddingLeft: 20 }}>
          <li>{t('install.stepsChrome1')}</li>
          <li>{t('install.stepsChrome2')}</li>
          <li>{t('install.stepsChrome3')}</li>
        </ol>
        <h3 className="mt-3">{t('install.stepsIosTitle')}</h3>
        <ol className="stack stack--tight" style={{ paddingLeft: 20 }}>
          <li>{t('install.stepsIos1')}</li>
          <li>{t('install.stepsIos2')}</li>
          <li>{t('install.stepsIos3')}</li>
        </ol>
      </section>

      <section className="card section" aria-labelledby="open-heading">
        <h2 id="open-heading" className="card__title">{t('install.stepsOpenTitle')}</h2>
        <ol className="stack stack--tight" style={{ paddingLeft: 20 }}>
          <li>{t('install.stepsOpen1')}</li>
        </ol>
      </section>

      <section className="card section" aria-labelledby="offline-heading">
        <h2 id="offline-heading" className="card__title">{t('install.offlineTitle')}</h2>
        <ul className="stack stack--tight" style={{ paddingLeft: 20 }}>
          <li>{t('install.offline1')}</li>
          <li>{t('install.offline2')}</li>
          <li>{t('install.offline3')}</li>
        </ul>
      </section>

      <section className="card section" aria-labelledby="indicator-heading">
        <h2 id="indicator-heading" className="card__title">{t('install.offlineIndicatorTitle')}</h2>
        <p>{t('install.offlineIndicatorBody')}</p>
      </section>

      <section className="card section" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="card__title">{t('install.backupTitle')}</h2>
        <p>{t('install.backupBody')}</p>
      </section>

      <section className="card section" aria-labelledby="trouble-heading">
        <h2 id="trouble-heading" className="card__title">{t('install.troubleTitle')}</h2>
        <ul className="stack stack--tight" style={{ paddingLeft: 20 }}>
          <li>{t('install.trouble1')}</li>
          <li>{t('install.trouble2')}</li>
          <li>{t('install.trouble3')}</li>
        </ul>
      </section>
    </div>
  );
}

export default InstallScreen;