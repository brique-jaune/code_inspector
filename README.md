# code-inspector

Un mod Claude Code qui ouvre, à droite de la conversation, un panneau de revue
de la branche en cours : ce qu'elle apporte, son code, et les choix que Claude
a faits en route. Pour relire ce que Claude a écrit, avec le contexte et les
suites à donner, sans quitter la session ni relire toute la conversation.

## Ce que montre le panneau

Tout porte sur la branche : ce qu'elle change par rapport à la branche dont
elle a été tirée, commité ou non. Trois onglets, la base du diff affichée à
côté.

### Summary

Ce qu'apporte la branche, écrit par Claude et tenu à jour au fil du travail.
Tant qu'il n'y en a pas, un bouton le demande à Claude.

### Code

- **Liste des fichiers modifiés** : statut (`M`, `A`, `D`, `R`, `?`), chemin et
  nombre de lignes ajoutées et retirées. La liste se met à jour après chaque
  écriture de Claude et à la fin de chaque tour.
- **Diff au clic** : un clic sur le nom d'un fichier déplie son diff, un second
  le replie.
- **Case « lu »** : cocher `[ ]` barre le nom du fichier, pour marquer que son
  diff a été lu en entier. Si le fichier change ensuite, la coche tombe.
- **Question sur une ligne** : dans un diff déplié, un clic sur le `?` d'une
  ligne ouvre un champ dessous. Entrée envoie la question à Claude, avec le chemin, le
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

### Notes

Une note par **pushback** (désaccord, mise en garde, demande que Claude n'a pas
suivie telle quelle) et par **arbitrage** (choix entre plusieurs options,
compromis, chose laissée de côté) : ce que Claude a décidé, pourquoi, et le
fichier visé s'il y en a un.

Un clic sur le `?` d'une note ouvre un champ dessous, comme sur une ligne de
diff : Entrée envoie le commentaire à Claude avec la note, pour traiter le
point ou demander une clarification ; champ vide, Claude clarifie la note. Il
répond dans la conversation, puis met la note à jour ou la clôt. Les notes
closes restent en bas, grisées.

### D'où viennent le summary et les notes

Le mod donne à Claude un outil, `inspect_report`, et une consigne dans son
system prompt : consigner chaque pushback et chaque arbitrage au moment où il
le fait, et tenir le summary à jour. L'outil n'écrit que dans le stockage du
mod : aucune permission n'est demandée. Summary et notes sont gardés par dépôt
et par branche, d'une session à l'autre.

## Utilisation

Dans un dépôt git, taper `/inspect` pour ouvrir le panneau.

Git ne retient pas d'où une branche a été tirée : le mod prend la branche
(locale ou `origin/*`) dont le point de divergence est le plus proche de
`HEAD`, et `main` ou `master` à égalité. Sur `main` ou `master` même, il montre
le working tree contre `HEAD`. Quand il se trompe :

```
/inspect develop    # fixe la base du diff pour cette branche
/inspect auto       # revient à la déduction
```

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

- Le diff est dessiné ligne à ligne pour rester cliquable (clic sur le `?` en
  début de ligne). Chaque ligne est colorée seule : une chaîne ou un
  commentaire sur plusieurs lignes peut être mal coloré.
- La base déduite peut être une branche sœur, créée depuis celle-ci ou au même
  point : `/inspect <branche>` la corrige. Sans autre branche, le diff se fait
  contre `HEAD`.
- Les notes ne valent que ce que Claude consigne : un choix qu'il n'a pas vu
  comme un arbitrage n'y figure pas.
- Le fil d'un commentaire n'est pas gardé sous la note : la réponse est dans
  la conversation, la note porte l'état final.
- Le jugement se fait par fichier, pas par hunk.
- Les diffs très longs sont tronqués, à l'affichage comme dans la demande au
  modèle ; un fichier trop volumineux pour être jugé reste affiché.
- Au-delà de 150 fichiers modifiés, seuls les 150 premiers sont listés.
