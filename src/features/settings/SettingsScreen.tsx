import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Download, Moon, Monitor, Sun, Trash2, Upload, Wifi } from 'lucide-react';
import { PageHeader } from '@/components/common/Badges';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { getServices } from '@/services/serviceFactory';
import { parseBackup } from '@/domain/validation';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import type { Language, ThemePreference, LockPolicy } from '@/domain/types';
import { pinService } from '@/services/pin/pinService';
import { useLock } from '@/hooks/useLock';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

const LOCK_POLICIES: { value: LockPolicy; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'minute-1', label: '1 minute' },
  { value: 'minute-5', label: '5 minutes' },
  { value: 'minute-15', label: '15 minutes' },
];

export function SettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, loading: settingsLoading, loadError } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PIN state
  const { policy: lockPolicy, lock } = useLock();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeBusy, setPinChangeBusy] = useState(false);

  useEffect(() => {
    pinService.status().then((s) => setPinEnabled(s.enabled));
  }, []);

  const handlePinToggle = async () => {
    if (pinEnabled) {
      setPinChangeOpen(true);
    } else {
      navigate('/settings/privacy/setup');
    }
  };

  const handlePinChange = async () => {
    if (pinNew !== pinConfirm) {
      setPinChangeError('privacy.pinMismatch');
      return;
    }
    if (!/^\d{4,6}$/.test(pinNew)) {
      setPinChangeError('validation.pinFormat');
      return;
    }
    setPinChangeBusy(true);
    setPinChangeError(null);
    try {
      await pinService.change(pinCurrent, pinNew);
      toast.push('success', t('privacy.pinChanged'));
      setPinChangeOpen(false);
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
    } catch (err) {
      const key = (err as { i18nKey?: string }).i18nKey ?? 'errors.generic';
      setPinChangeError(t(key));
    } finally {
      setPinChangeBusy(false);
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    await updateSettings({ language: lang });
    toast.push('success', t('messages.settingsSaved'));
  };

  const handleThemeChange = async (theme: ThemePreference) => {
    await updateSettings({ theme });
  };

  const handleLockPolicyChange = async (policy: LockPolicy) => {
    await updateSettings({ lockPolicy: policy });
  };

  const triggerExport = async () => {
    setExportBusy(true);
    try {
      const backup = await getServices().backup.exportAll();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kiranaiq-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.push('success', t('settings.exportSuccess'));
    } catch (err) {
      console.error('[settings] export failed', err);
      toast.push('error', t('errors.exportFailed'));
    } finally {
      setExportBusy(false);
    }
  };

  const triggerImport = async () => {
    if (!importFile || importBusy) return;
    setImportBusy(true);
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      const result = parseBackup(parsed);
      if (!result.ok) throw new Error(result.error);
      await getServices().backup.importAll(result.backup);
      toast.push('success', t('settings.importSuccess', { count: result.backup.data.products.length }));
      setImportFile(null);
      setImportConfirmOpen(false);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[settings] import failed', err);
      toast.push('error', t('errors.importInvalid'));
    } finally {
      setImportBusy(false);
    }
  };

  const triggerResetDemo = async () => {
    setResetBusy(true);
    try {
      await getServices().settings.resetDemoData();
      toast.push('success', t('settings.resetDemoDone'));
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[settings] reset failed', err);
      toast.push('error', t('errors.generic'));
    } finally {
      setResetBusy(false);
      setResetConfirmOpen(false);
    }
  };

  if (settingsLoading) return <div className="state-box" role="status">Loading settings…</div>;
  if (loadError) return <div className="alert alert--error">{t(loadError)}</div>;

  return (
    <>
      <PageHeader title={t('settings.title')} />

      <section className="card section" aria-labelledby="general-heading">
        <h2 id="general-heading" className="card__title">{t('common.appName')} {t('settings.general')}</h2>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('settings.shopName')}</span>
            <input
              className="input"
              value={settings.shopName ?? ''}
              placeholder={t('settings.shopNamePlaceholder')}
              onChange={(e) => updateSettings({ shopName: e.target.value.trim() || undefined })}
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">{t('settings.language')}</span>
          <div className="segmented" role="group" aria-label={t('a11y.languageSelect')}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className="segmented__option"
                aria-pressed={settings.language === l.code}
                onClick={() => handleLanguageChange(l.code)}
              >
                {t(`onboarding.language${l.code === 'en' ? 'English' : l.code === 'ta' ? 'Tamil' : 'Hindi'}`)}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span className="field__label">{t('settings.theme')}</span>
          <div className="segmented" role="group" aria-label={t('a11y.themeSelect')}>
            {THEME_OPTIONS.map(({ value, Icon }) => (
              <button
                key={value}
                type="button"
                className="segmented__option"
                aria-pressed={settings.theme === value}
                onClick={() => handleThemeChange(value)}
              >
                <span className="row" style={{ justifyContent: 'center', gap: 6 }}>
                  <Icon size={18} aria-hidden="true" />
                  {t(`onboarding.theme${value === 'light' ? 'Light' : value === 'dark' ? 'Dark' : 'System'}`)}
                </span>
              </button>
            ))}
          </div>
        </label>

        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('settings.currency')}</span>
            <input className="input" value="INR" readOnly />
            <span className="field__hint">{t('settings.currencyNote')}</span>
          </label>
        </div>
      </section>

      <section className="card section" aria-labelledby="defaults-heading">
        <h2 id="defaults-heading" className="card__title">{t('settings.defaults')}</h2>
        <div className="form-grid form-grid--2">
          <label className="field">
            <span className="field__label">{t('settings.expiryWarningDays')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={settings.expiryWarningDays}
              onChange={(e) => updateSettings({ expiryWarningDays: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('settings.defaultReorderThreshold')}</span>
            <input
              className="input"
              type="number"
              min={0}
              max={10000}
              value={settings.defaultReorderThreshold}
              onChange={(e) => updateSettings({ defaultReorderThreshold: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('settings.slowMovingWindow')}</span>
            <input
              className="input"
              type="number"
              min={7}
              max={365}
              value={settings.slowMovingDays}
              onChange={(e) => updateSettings({ slowMovingDays: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('settings.restockLookback')}</span>
            <input
              className="input"
              type="number"
              min={7}
              max={180}
              value={settings.restockLookbackDays}
              onChange={(e) => updateSettings({ restockLookbackDays: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="card section" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="card__title">{t('privacy.title')}</h2>

        {pinEnabled ? (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="pinEnabled"
                checked={pinEnabled}
                onChange={handlePinToggle}
              />
              <label htmlFor="pinEnabled">
                <strong>{t('privacy.pinDisable')}</strong>
                <br />
                <span className="field__hint">{t('privacy.pinWhatItDoes')}</span>
              </label>
            </div>

            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => { setPinChangeOpen(true); }}
            >
              {t('privacy.pinChange')}
            </button>

            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => lock()}
            >
              {t('privacy.pinLockNow')}
            </button>

            <label className="field">
              <span className="field__label">{t('privacy.pinInactivity')}</span>
              <select
                className="select"
                value={lockPolicy}
                onChange={(e) => handleLockPolicyChange(e.target.value as LockPolicy)}
              >
                {LOCK_POLICIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {t(`privacy.pinPolicy${p.value === 'immediate' ? 'Immediate' : p.value === 'minute-1' ? '1' : p.value === 'minute-5' ? '5' : '15'}`)}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-xs muted">{t('privacy.pinWhatItIsNot')}</p>
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="pinEnabled"
                checked={false}
                onChange={handlePinToggle}
              />
              <label htmlFor="pinEnabled">
                <strong>{t('privacy.pinEnable')}</strong>
                <br />
                <span className="field__hint">{t('privacy.pinWhatItDoes')}</span>
              </label>
            </div>
            <p className="text-xs muted">{t('privacy.pinWhatItIsNot')}</p>
          </div>
        )}

        <ConfirmDialog
          open={pinChangeOpen}
          title={t('privacy.pinChange')}
          body={
            <div className="stack">
              <label className="field">
                <span className="field__label">{t('privacy.pinCurrent')}</span>
                <input
                  type="password"
                  className="input"
                  value={pinCurrent}
                  onChange={(e) => setPinCurrent(e.target.value)}
                  maxLength={6}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('privacy.pinNew')}</span>
                <input
                  type="password"
                  className="input"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value)}
                  maxLength={6}
                />
              </label>
              <label className="field">
                <span className="field__label">{t('privacy.pinConfirm')}</span>
                <input
                  type="password"
                  className="input"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                  maxLength={6}
                />
              </label>
              {pinChangeError && <div className="alert alert--error">{pinChangeError}</div>}
            </div>
          }
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          busy={pinChangeBusy}
          onConfirm={handlePinChange}
          onCancel={() => { setPinChangeOpen(false); setPinCurrent(''); setPinNew(''); setPinConfirm(''); setPinChangeError(null); }}
        />
      </section>

      <section className="card section" aria-labelledby="data-heading">
        <h2 id="data-heading" className="card__title">{t('settings.dataManagement')}</h2>

        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={triggerExport}
            disabled={exportBusy}
          >
            <Download size={18} aria-hidden="true" />
            {t('settings.exportData')}
            {exportBusy && <span className="muted"> ({t('common.loading')})</span>}
          </button>

          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importBusy}
          >
            <Upload size={18} aria-hidden="true" />
            {t('settings.importData')}
          </button>

          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setResetConfirmOpen(true)}
            disabled={resetBusy}
          >
            <Trash2 size={18} aria-hidden="true" />
            {t('settings.resetDemo')}
            {resetBusy && <span className="muted"> ({t('common.loading')})</span>}
          </button>

          <div className="row">
            <span className="badge badge--demo">{t('common.demoBadge')}</span>
            <span className="text-xs muted">{t('settings.clearDemoHint')}</span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setImportFile(file);
              setImportConfirmOpen(true);
            }
          }}
        />
      </section>

      <section className="card section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="card__title">{t('settings.about')}</h2>
        <p className="text-sm muted">{t('settings.aboutBody')}</p>
        <p className="text-xs muted">{t('settings.appVersion', { version: '0.1.0' })}</p>
        <div className="stack mt-3" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('/install')}>
            <Wifi size={16} aria-hidden="true" />
            {t('settings.installHelp')}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={resetConfirmOpen}
        danger
        title={t('settings.resetDemo')}
        body={<p>{t('settings.resetDemoConfirm')}</p>}
        confirmLabel={t('common.confirm')}
        busy={resetBusy}
        onConfirm={triggerResetDemo}
        onCancel={() => setResetConfirmOpen(false)}
      />

      <ConfirmDialog
        open={importConfirmOpen}
        danger
        title={t('settings.importData')}
        body={<p>{t('settings.importConfirm')}</p>}
        confirmLabel={t('common.confirm')}
        busy={importBusy}
        onConfirm={triggerImport}
        onCancel={() => { setImportConfirmOpen(false); setImportFile(null); }}
      />
    </>
  );
}
export default SettingsScreen;