import type { Character } from '@lw/content';
import { BALANCE } from '@lw/game';
import type { StringKey } from '../../i18n';
import { PACK } from '../../game/pack';
import { unlockLines, type FriendRow, type UnlockLine } from '../../game/friendsLogic';
import { lineTokens, displayName } from '../../content';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';
import { HeartBar } from './HeartBar';
import { Ltr } from './WalletPill';

/** The place ids the character strings know (`social.place.<id>`); anything else is not named. */
const PLACE_KEYS = ['park', 'cafe', 'konbini', 'ramen', 'station', 'school'];

export interface FriendCardProps {
  row: FriendRow;
  who: Character;
  open: boolean;
  onToggle(): void;
  messageOpen: boolean;
  onTalk(): void;
  onGift(): void;
  onMessage(): void;
  onListen(beat: string): void;
}

/** "Next at ♥n: ..." as words (§8.6): the unlocks the pack has built for the next heart, or why there are none. */
export function nextText(t: (k: StringKey, v?: Record<string, string | number>) => string, lang: 'en' | 'ar', row: FriendRow, who: Character): string {
  if (row.hearts >= BALANCE.ap.thresholds.length) return t('social.maxed');
  const n = row.hearts + 1;
  const what = unlockLines(PACK, row.def, n).map((l: UnlockLine) => {
    if (l.kind === 'perk') return l.text[lang];
    if (l.kind === 'fact') return t('social.u.fact', { name: displayName(who, lang) });
    return t(`social.u.${l.key}` as StringKey);
  });
  return what.length ? t('social.nextAt', { n, what: what.join(', ') }) : t('social.more');
}

/**
 * One friend of the Friends screen: a header that opens the card (portrait, name, hearts) and, open, the Friend card of §8.6: the
 * meter and "Next at ♥n", the three facts learned so far (a locked one says at which heart it comes), the perks earned, and the
 * buttons Talk, Gift and Message (Message only once the phone is owned; Talk and Gift are always real buttons: a daily limit is said in
 * words on the gift sheet, never a dead end).
 */
export function FriendCard({ row, who, open, onToggle, messageOpen, onTalk, onGift, onMessage, onListen }: FriendCardProps) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const name = displayName(who, lang);
  const { def, state } = row;
  const place = PLACE_KEYS.includes(who.locationId) ? t(`social.place.${who.locationId}` as StringKey) : '';
  const earned = def.perks.filter((p) => p.heart <= row.hearts);

  return (
    <li className={`frd-card${open ? ' open' : ''}`} data-friend={def.id} data-hearts={row.hearts}>
      <button className="frd-head" aria-expanded={open} onClick={onToggle}>
        <Portrait spec={who.avatar} size={52} />
        <span className="frd-who">
          <strong dir="auto">{name}</strong>
          <small className="muted" dir="auto">
            {who.name.ja} · {who.job[lang]}
          </small>
          <HeartBar hearts={row.hearts} ap={row.ap} floor={row.floor} next={row.next} compact />
        </span>
        <Icon name="chevD" size={20} className="frd-chev" />
      </button>

      {open && (
        <div className="frd-body" data-card={def.id}>
          {row.pending.map((p) => (
            <div key={p.beat} className="frd-event" data-event={p.beat}>
              <span dir="auto">{t('social.eventReady', { name })}</span>
              <button className="btn primary sm" onClick={() => onListen(p.beat)}>
                {t('social.listen')}
              </button>
            </div>
          ))}

          {!row.met ? (
            <p className="muted" dir="auto">
              {t('social.unmet', { place })}
            </p>
          ) : (
            place && (
              <p className="muted" dir="auto">
                {t('social.at', { name, place })}
              </p>
            )
          )}

          <HeartBar hearts={row.hearts} ap={row.ap} floor={row.floor} next={row.next} />
          <p className="frd-next" data-next dir="auto">
            <Ltr text={nextText(t, lang, row, who)} />
          </p>

          <h3 className="frd-h">{t('social.facts', { name })}</h3>
          <ul className="frd-facts">
            {def.facts.map((id, i) => {
              const line = def.factLines?.[id];
              const known = state.learned.includes(id);
              return (
                <li key={id} className={`frd-fact${known ? ' known' : ''}${state.gold.includes(id) ? ' gold' : ''}`} data-fact={id} data-known={known ? '1' : '0'}>
                  {known && line ? (
                    <>
                      <JaText tokens={lineTokens(line.ja)} furigana={furigana} romaji={romaji} size="sm" />
                      <small className="muted" dir="auto">
                        {line[lang]}
                      </small>
                    </>
                  ) : (
                    <>
                      <Icon name="lock" size={16} />
                      <small className="muted" dir="auto">
                        <Ltr text={t('social.factLocked', { n: i + 1 })} />
                      </small>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {earned.length > 0 && (
            <>
              <h3 className="frd-h">{t('social.perks')}</h3>
              <ul className="frd-perks">
                {earned.map((p) => (
                  <li key={p.id} dir="auto">
                    {p.text[lang]}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="frd-actions">
            <button className="btn primary" data-act="talk" onClick={onTalk} disabled={!row.actions.talk}>
              <Icon name="message" size={18} /> {t('social.talk')}
            </button>
            <button className="btn soft" data-act="gift" onClick={onGift} disabled={!row.actions.talk}>
              <Icon name="gift" size={18} /> {t('social.giftBtn')}
            </button>
            {messageOpen && (
              <button className="btn soft" data-act="message" onClick={onMessage}>
                <Icon name="phone" size={18} /> {t('social.message')}
                {state.unread > 0 && (
                  <bdi dir="ltr" className="frd-badge" aria-hidden="true">
                    {state.unread}
                  </bdi>
                )}
              </button>
            )}
          </div>
          {row.talkedToday && (
            <small className="muted" dir="auto">
              {t('social.talkDone')}
            </small>
          )}
        </div>
      )}
    </li>
  );
}
