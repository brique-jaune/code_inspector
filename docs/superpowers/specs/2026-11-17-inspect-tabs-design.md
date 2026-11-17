# Onglets Summary / Code / Notes dans le panneau Inspect

Date : 2026-11-17

## Intention

Donner au dev du contexte et de la visibilité sur les next steps sans relire
toute la conversation : ce que le changement apporte, le code, et les choix
que Claude a faits en route.

## Buts

- Trois onglets dans le panneau `code-inspector` : **Summary**, **Code**,
  **Notes**.
- **Summary** : explication claire de ce qu'apporte la PR, écrite par Claude
  (la session principale).
- **Code** : le panneau actuel, inchangé dans son comportement (liste, diff,
  lu, filtres, `?` par ligne), mais sur le périmètre de la branche.
- **Notes** : chaque pushback et chaque arbitrage de Claude, un par entrée,
  avec son explication. Sur chaque note, un champ commentaire comme sur une
  ligne de diff, pour traiter le point ou demander une clarification à Claude.
- Périmètre = la PR : tout ce que la branche apporte par rapport à la branche
  dont elle a été tirée, commité ou non.

## Non-buts

- Pas de fil de discussion stocké sous une note : la réponse de Claude arrive
  dans la conversation, la note est mise à jour ou close par Claude.
- Pas de résumé généré par un modèle tiers depuis le diff.
- Pas de lien avec GitHub (PR distante, commentaires de revue).
- Pas de hook sur le commit.

## Anti-buts

- Un onglet Notes vide parce que Claude n'a rien consigné : la consigne du
  system prompt doit rendre l'écriture des notes systématique.
- Une base de diff fausse sans que le dev le voie : la base est toujours
  affichée.

## Contraintes

- Un seul module `hooks/register.tsx`, pas de DOM ni de Node : tout passe
  par `$`.
- Le rendu n'écrit pas d'état ; les écritures partent des handlers et des
  autres événements.
- Les valeurs stockées survivent à un reload : tout changement de forme
  change le tag `shape`.
- Les textes venant du dépôt ou d'une note restent clôturés (`fenced`) dans
  les prompts envoyés.

## Approches

Périmètre du diff :

- Working tree contre `HEAD` (actuel) : simple, mais l'onglet Code se vide au
  commit. Écarté.
- **Branche contre sa base** : retenu par l'utilisateur. Colle au mot « PR ».

Trouver la base (git ne garde pas « tirée depuis ») :

- **A. Branche la plus proche** : parmi les autres branches locales et
  `origin/*`, celle dont le merge-base avec `HEAD` est le plus récent ;
  égalité → branche par défaut. Marche pour une branche tirée d'une feature.
  Peut se tromper si une branche sœur est créée depuis celle-ci.
  **Retenu par l'utilisateur**, avec la base affichée et `/inspect <branche>`
  pour la forcer.
- B. Branche par défaut seulement : prévisible, faux hors `main`. Écarté.
- C. Reflog : absent après un clone, souvent `HEAD`. Écarté.

Qui écrit Summary et Notes :

- **Un outil appelé par Claude + une section de system prompt** : retenu,
  seule façon de connaître les arbitrages.
- Résumé par haiku depuis le diff : ignore les arbitrages. Écarté.

## Design

### Base et diff

- Au refresh : si une base est forcée pour cette branche, la prendre ; sinon
  la déduire (approche A). Sans autre branche ou sans commit : repli sur le
  comportement actuel (`HEAD`, ou l'arbre vide).
- Diff de chaque fichier : `git diff <merge-base> -- <path>` ; fichiers non
  suivis comme aujourd'hui. Liste = fichiers changés depuis le merge-base,
  plus le `git status`.
- `/inspect <branche>` force la base pour la branche courante ; `/inspect`
  seul ouvre le panneau. Une branche inconnue donne une erreur lisible.
- Le nom de la base est affiché à droite de la barre d'onglets.

### Onglets

- `view.tab` : `'summary' | 'code' | 'notes'`, `'code'` par défaut.
- Barre : `[Summary] [Code n] [Notes n]`, n = fichiers affichés et notes
  ouvertes ; l'onglet actif est en gras.
- Les filtres et le bouton de jugement n'apparaissent que dans Code.

### Rapport (Summary + Notes)

- Valeur `report` : `{ summary: string, notes: Note[] }`.
- `Note` : `{ id, kind: 'pushback' | 'arbitrage', title, detail, path?,
  isClosed }`.
- Tenu dans `$.state` pour le dessin, et recopié dans `$.store` sous une clé
  dépôt + branche ; rechargé à `session.start` et quand la branche change.

### Outil `inspect_report`

Appelé par Claude. Une entrée, une action :

- `set_summary { text }`
- `add_note { kind, title, detail, path? }` → rend l'`id`
- `update_note { id, title?, detail?, path? }`
- `close_note { id }`

Un `id` inconnu rend une erreur que Claude peut lire.

### Consigne (system prompt)

Section ajoutée par `prompt.compose` : consigner via `inspect_report` chaque
pushback (désaccord avec une demande, mise en garde) et chaque arbitrage
(choix entre plusieurs options, compromis accepté) au moment où il est fait,
avec le pourquoi ; tenir le summary à jour quand le changement prend forme ;
clore une note quand son point est traité.

### Onglet Summary

Le texte du summary ; sans summary, une ligne grisée et un bouton « Demander
le summary à Claude », qui envoie un prompt.

### Onglet Notes

- Notes ouvertes d'abord, closes ensuite, grisées.
- Chaque note : `?`, le type, le titre, puis le détail et le chemin.
- `?` ouvre un champ sous la note (même état `commentTarget`, étendu à une
  note). Entrée envoie à Claude, par `$.prompt.submit`, la note clôturée et
  le commentaire ; la consigne dit de répondre puis de mettre la note à jour
  ou de la clore. Champ vide : demande de clarifier la note.

### Tests

Dans `tests/pane.test.tsx` : choix d'onglet, parsing de la base déduite et
forcée, les quatre actions de l'outil, l'envoi d'un commentaire sur une note,
le rechargement du rapport depuis `$.store`.

### Aussi

README mis à jour ; version passée à 0.3.0.

## Laissé au constructeur

- La commande git exacte pour la branche la plus proche.
- La forme de la clé `$.store` et la limite de taille des textes.
- Le dessin exact des lignes de note.
