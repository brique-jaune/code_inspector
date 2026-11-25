# Suivi PR : masquer les reviews demandées à une équipe

Date : 2026-11-25

## Intention

La section « 📄 À reviewer » mélange les pull requests où le dev est nommé
reviewer et celles où la review est demandée à une de ses équipes. Les secondes
font du bruit : le dev veut pouvoir ne garder que celles qui l'attendent, lui.

## Buts

- Un bouton dans le panneau masque les reviews demandées à une équipe.
- Le choix est gardé d'une session à l'autre.

## Non-buts

- Pas de filtre sur les pull requests du dev lui-même.
- Pas de filtre par équipe, par dépôt ou par auteur.

## Anti-buts

- Un changement de comportement pour qui ne touche pas au bouton : par défaut,
  tout reste affiché.
- Un deuxième appel à `gh` : les trois recherches partent dans une requête.
- Des compteurs faux quand GitHub a plus de 50 résultats.

## Approches

- **A. Une troisième recherche, `user-review-requested:@me`** — retenue. Ce
  qualifier de GitHub ne rend que les demandes faites au dev en personne. La
  liste et son total viennent de GitHub : la ligne « … N de plus » reste juste.
- **B. Lire `reviewRequests` de chaque pull request et filtrer dans le mod** —
  écartée : il faut le login du dev, et le total est faux au-delà des 50
  listées.
- **C. Un argument, `/prs direct`** — écartée : moins visible qu'un bouton, et
  il faut retaper la commande pour changer d'avis.

## Conception

- `Board` gagne `direct` et `directTotal` ; son tag passe à `board-2`.
- Une valeur de session `isDirectOnly` (booléen, `false` par défaut), lue dans
  `$.store` à `session.start` et écrite dans `$.store` à chaque bascule.
- L'en-tête de « 📄 À reviewer » porte le bouton : « Masquer équipes » quand
  tout est affiché, « Afficher équipes » quand le filtre est actif. Il reste
  là quand la liste est vide, pour pouvoir revenir en arrière.
- Filtre actif : la liste, le compteur 📄 et la ligne « … N de plus » lisent
  `direct`.

## Laissé à l'implémentation

- Le texte exact des lignes vides et de la ligne « … N de plus » du filtre.
