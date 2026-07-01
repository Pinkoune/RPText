// Annonce des nouveautés affichée une fois à l'ouverture du jeu.
// Change PATCH_VERSION (et complète PATCH_NOTES) à chaque nouvelle vague de
// modifs à annoncer ; l'utilisateur indique quand la réinitialiser (au push).

export const PATCH_VERSION = 'familiars-v1';

export interface PatchSection {
  title: string;
  items: string[];
}

export const PATCH_NOTES: PatchSection[] = [
  {
    title: '🐾 Familiers',
    items: [
      'Adopte un familier (commun/rare/épique en boutique de familiers, légendaire en butin rare de boss mondial).',
      'Équipe-le pour un petit bonus de stat (ATK, DEF ou PV) qui grandit avec ses victoires à tes côtés, jusqu\'au niveau 10.',
      'Bonus volontairement modeste : un compagnon, pas une arme secrète.',
      'Commande : « familiar » (ou « pet », « compagnon »).',
    ],
  },
  {
    title: '🌳 Arbre de talents refait',
    items: [
      '3 paliers par classe (9 talents + 1 capstone), déblocage progressif à 5 puis 10 points investis.',
      'Nouveaux effets : vol de vie, perce-armure, dégâts d\'exécution sur cible affaiblie, épines, multiplicateur de critique, et bonus permanents ATK/DEF/PV%.',
      'Coût pour tout maximiser une classe : 23 points (~niveau 24) — une vraie progression de fond.',
      'Tes points déjà investis sont conservés (rien n\'est perdu par le remaniement).',
    ],
  },
];
