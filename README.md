# code-inspector

Un mod Claude Code qui ouvre, à droite de la conversation, un panneau listant
les modifications en cours du working tree git, pour relire ce que Claude vient
d'écrire sans quitter la session.

## Ce que fait le panneau

- **Liste des fichiers modifiés** : statut (`M`, `A`, `D`, `R`, `?`), chemin et
  nombre de lignes ajoutées et retirées. La liste se met à jour après chaque
  écriture de Claude et à la fin de chaque tour.
- **Diff au clic** : un clic sur le nom d'un fichier déplie son diff, un second
  le replie.
- **Case « lu »** : cocher `[ ]` barre le nom du fichier, pour marquer que son
  diff a été lu en entier. Si le fichier change ensuite, la coche tombe.
- **Question sur une ligne** : dans un diff déplié, un clic sur une ligne ouvre
  un champ dessous. Entrée envoie la question à Claude, avec le chemin, le
  numéro de ligne et le hunk autour ; champ vide, Claude explique la ligne. La
  réponse arrive dans la conversation. Pendant un tour, la question part dès
  que la session est libre.
- **Boutons « Masquer les tests » et « Masquer les lus »** : retirent de la
  liste les fichiers de test (reconnus à leur chemin : `tests/`, `__tests__/`,
  `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py`, `*Test.php`…) et les
  fichiers cochés « lu ». Un second clic les ramène.
- **Bouton « Masquer le sans-intérêt »** : un modèle juge chaque diff et masque
  les fichiers qui ne méritent pas de revue (lockfiles, fichiers générés,
  formatage, renommages mécaniques…). « Tout afficher » les ramène.

Le bouton n'apparaît qu'une fois le tour de Claude terminé, donc quand les
modifications sont finies. Un clic fait un seul appel au modèle (`haiku`), pour
tous les fichiers à la fois. Un verdict reste valable tant que le diff du
fichier ne change pas : recliquer sans nouvelle modification ne coûte rien.

## Utilisation

Dans un dépôt git, taper `/inspect` pour ouvrir le panneau.

## Installation

À l'invite d'une session en terminal :

```
/plugin install code-inspector --marketplace brique-jaune/code_inspector
```

Répondre `y` pour ajouter la marketplace, puis choisir une portée.

Depuis un shell :

```
claude plugin install code-inspector --marketplace brique-jaune/code_inspector
```

Dans l'application de bureau, où `/plugin` ne s'exécute pas : cliquer sur `+`
à côté de la zone de saisie, puis Plugins, Add marketplace avec
`brique-jaune/code_inspector`, puis Add plugin.

## Développement

```
claude --plugin-dir .        # charge le mod depuis ce dossier
claude plugin validate .     # vérifie le manifeste et le module
claude plugin test .         # lance tests/*.test.tsx
```

## Limites

- Le diff est dessiné ligne à ligne pour rester cliquable : ajouts en vert,
  retraits en rouge, sans coloration syntaxique.
- Le jugement se fait par fichier, pas par hunk.
- Les diffs très longs sont tronqués, à l'affichage comme dans la demande au
  modèle ; un fichier trop volumineux pour être jugé reste affiché.
- Au-delà de 150 fichiers modifiés, seuls les 150 premiers sont listés.
