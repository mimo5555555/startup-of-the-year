import type { ReactNode } from 'react';
import { useT } from '../../hooks';
import { Icon } from '../Icon';

export type PhoneTab = 'messages' | 'map';

/**
 * The phone as a frame (§8.7): a title bar with a back button, the app area and the two apps along the bottom, Messages (with the
 * number of threads waiting) and Map pins. On a narrow screen it fills the screen; on a wide one it is a phone-sized column.
 * `onTab` is absent while a screen of the phone has no tabs to switch (the "buy a phone" notice).
 */
export function PhoneFrame({
  title,
  sub,
  onBack,
  backLabel,
  tab,
  onTab,
  unread = 0,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onBack(): void;
  backLabel: string;
  tab: PhoneTab;
  onTab?(tab: PhoneTab): void;
  unread?: number;
  children: ReactNode;
}) {
  const { t, dir } = useT();
  return (
    <div className="panel ph" dir={dir} data-screen="phone" data-tab={tab}>
      <div className="ph-frame">
        <header className="ph-bar">
          <button className="icon-btn ghost" onClick={onBack} aria-label={backLabel} data-act="phone-back">
            <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
          </button>
          <div className="ph-title">
            <h1>{title}</h1>
            {sub && <small dir="auto">{sub}</small>}
          </div>
          <span />
        </header>
        <div className="ph-body">{children}</div>
        {onTab && (
          <nav className="ph-tabs" aria-label={t('phone.tabs')}>
            <button className={`ph-tab${tab === 'messages' ? ' on' : ''}`} aria-pressed={tab === 'messages'} data-tab-btn="messages" onClick={() => onTab('messages')}>
              <span className="ph-tab-ic">
                <Icon name="message" size={22} />
                {unread > 0 && (
                  <span className="ph-badge" data-unread-total={unread} aria-label={t('phone.unread', { n: unread })}>
                    {unread}
                  </span>
                )}
              </span>
              {t('phone.tab.messages')}
            </button>
            <button className={`ph-tab${tab === 'map' ? ' on' : ''}`} aria-pressed={tab === 'map'} data-tab-btn="map" onClick={() => onTab('map')}>
              <span className="ph-tab-ic">
                <Icon name="map" size={22} />
              </span>
              {t('phone.tab.map')}
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
