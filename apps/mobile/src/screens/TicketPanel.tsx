import { useT } from '../hooks';

// Placeholder (2A): agent 2G fills the ticket machines (ramen shop, station); agent 2B opens it from the world's `ticket` and
// `ramen_machine` picks. `onClose` closes the panel and returns to the world.
export function TicketPanel({ kind, onClose }: { kind: 'ramen' | 'station'; onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="scrim" role="dialog" data-kind={kind} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', marginInline: 'auto' }}>
        <div className="word-sheet">
          <h2>{t('hud.wallet')}</h2>
          <button className="btn soft wide" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
