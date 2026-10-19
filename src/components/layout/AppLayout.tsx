import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  House,
  PackagePlus,
  RefreshCcw,
  Settings,
  TimerReset,
} from 'lucide-react';
import { ConnectionChip } from '@/components/feedback/ConnectionStatus';

/**
 * Primary app layout:
 * - sticky top bar (brand, connection status, settings)
 * - bottom navigation for thumb reach on phones
 * - <main> with safe-area padding
 * Secondary screens (movements, slow-moving, install help…) are reachable
 * from the dashboard, product pages and Settings.
 */
export function AppLayout() {
  const { t } = useTranslation();

  const links = [
    { to: '/', label: t('navigation.dashboard'), Icon: House, end: true },
    { to: '/products', label: t('navigation.products'), Icon: Boxes },
    { to: '/sales/new', label: t('navigation.sales'), Icon: PackagePlus, accent: true },
    { to: '/restock', label: t('navigation.restock'), Icon: RefreshCcw },
    { to: '/settings', label: t('navigation.settings'), Icon: Settings },
  ];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('navigation.skipToContent')}
      </a>

      <header className="topbar">
        <NavLink to="/" className="topbar__brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          <span>{t('common.appName')}</span>
        </NavLink>
        <div className="topbar__tools">
          <ConnectionChip />
        </div>
      </header>

      <main className="app-main" id="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label={t('navigation.mainMenu')}>
        {links.map(({ to, label, Icon, end, accent }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={`bottom-nav__link${accent ? ' bottom-nav__link--accent' : ''}`}
          >
            <span className="bottom-nav__icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Compact secondary navigation row for sub-screens (expiry, slow-moving…). */
export function SubNav() {
  const { t } = useTranslation();
  const items = [
    { to: '/movements', label: t('navigation.movements') },
    { to: '/expiry', label: t('navigation.expiry') },
    { to: '/slow-moving', label: t('navigation.slowMoving') },
    { to: '/install', label: t('navigation.install') },
  ];
  return (
    <nav className="row mb-4" aria-label={t('navigation.mainMenu')} style={{ gap: 'var(--space-2)' }}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className="btn btn--secondary btn--sm"
          style={{ textDecoration: 'none' }}
        >
          {item.label}
        </NavLink>
      ))}
      <NavLink
        to="/purchases/new"
        className="btn btn--secondary btn--sm"
        style={{ textDecoration: 'none' }}
      >
        <TimerReset size={16} aria-hidden="true" />
        {t('navigation.purchases')}
      </NavLink>
    </nav>
  );
}
