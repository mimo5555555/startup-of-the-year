import { useT } from '../hooks';

// Placeholder (2A): agent 2G fills the vending-machine panel; agent 2B opens it from the world's `vending` pick.
// `onClose` closes the panel and returns to the world.
export function VendingPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="scrim" role="dialog" onClick={onClose}>
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

