// The two genkan buttons (Release 2 wave B1): shoes off, then slippers. The same card is used over the 3D room and over the panel
// fallback, so the entrance plays the same either way; tapping the shoes or the slippers in the 3D room is the same press.
import { useT } from '../../hooks';
import { Icon } from '../Icon';

export type GenkanStep = 'shoes' | 'slippers';

export interface GenkanButtonsProps {
  shoesOff: boolean;
  slippersOn: boolean;
  onPress: (which: GenkanStep) => void;
}

export function GenkanButtons({ shoesOff, slippersOn, onPress }: GenkanButtonsProps) {
  const { t } = useT();
  const step = (which: GenkanStep, n: number, done: boolean, label: string, icon: 'walk' | 'home') => (
    <button
      type="button"
      className={`btn ${done ? 'soft' : 'primary'} home-step${done ? ' done' : ''}`}
      data-genkan={which}
      aria-disabled={done}
      onClick={() => onPress(which)}
    >
      <span className="home-step-n" aria-hidden="true">
        {done ? <Icon name="check" size={16} stroke={3} /> : n}
      </span>
      <Icon name={icon} size={20} />
      <span className="home-step-label">{label}</span>
      {done && <span className="home-sr">{t('home.done')}</span>}
    </button>
  );
  return (
    <div className="home-genkan glass-card" data-home="genkan">
      <h2 className="home-genkan-title">{t('fv.genkan.title')}</h2>
      <p className="home-genkan-hint">{t('fv.genkan.hint')}</p>
      <div className="home-genkan-btns">
        {step('shoes', 1, shoesOff, t('home.shoesOff'), 'walk')}
        {step('slippers', 2, slippersOn, t('home.slippers'), 'home')}
      </div>
    </div>
  );
}
