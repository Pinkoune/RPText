import { getItem, RARITY_COLOR } from '../game/items';
import { ITEM_ICONS } from '../game/icons';

/**
 * Icône d'objet : rend l'asset Game Icons (react-icons/gi) teinté par la rareté,
 * avec repli sur l'emoji d'origine si l'objet n'est pas encore mappé. Permet une
 * migration progressive des emojis vers des assets vectoriels cohérents.
 */
export default function ItemIcon({
  id,
  size = 20,
  color,
  className = '',
  title,
}: {
  id: string;
  size?: number;
  /** Force une couleur ; sinon teinte par rareté. */
  color?: string;
  className?: string;
  title?: string;
}) {
  const baseId = id.split(':')[0];
  const it = getItem(id);
  const Comp = ITEM_ICONS[baseId];
  // Le Cœur chanceux garde son rose peu importe la rareté (identité visuelle du porte-bonheur).
  const tint = color ?? (baseId === 'coeur_chanceux' ? '#ff6fa5' : it ? RARITY_COLOR[it.rarity] : '#b8c0cf');
  const label = title ?? it?.name;

  if (Comp) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} title={label} style={{ lineHeight: 0 }}>
        <Comp size={size} color={tint} aria-label={label} />
      </span>
    );
  }
  // Repli : emoji d'origine.
  return (
    <span className={`inline-block shrink-0 ${className}`} title={label} style={{ fontSize: size * 0.9, lineHeight: 1 }}>
      {it?.icon ?? '❔'}
    </span>
  );
}
