import { MONSTER_ICONS } from '../game/monsterIcons';

/**
 * Icône de monstre : rend l'asset Game Icons (react-icons/gi), avec repli sur
 * l'emoji d'origine si le monstre n'est pas encore mappé. Miroir de ItemIcon.
 */
export default function MonsterIcon({
  id,
  emoji,
  size = 20,
  color = '#e2b8b8',
  className = '',
  title,
}: {
  id: string;
  /** Emoji de repli (depuis MonsterDef.emoji ou équivalent). */
  emoji?: string;
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  const Comp = MONSTER_ICONS[id];

  if (Comp) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} title={title} style={{ lineHeight: 0 }}>
        <Comp size={size} color={color} aria-label={title} />
      </span>
    );
  }
  return (
    <span className={`inline-block shrink-0 ${className}`} title={title} style={{ fontSize: size * 0.9, lineHeight: 1 }}>
      {emoji ?? '👿'}
    </span>
  );
}
