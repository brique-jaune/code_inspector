# Ouverture automatique du panneau Inspect

Date : 2026-11-23

## Intention

Quand Claude commence à écrire du code, taper `/inspect` arrive trop tard : la
commande part en file d'attente derrière le tour en cours et le panneau
n'apparaît qu'à la fin. Le mod doit ouvrir le panneau lui-même, en plein tour,
dès qu'il y a du code à lire.

## Buts

- Le panneau s'ouvre seul à la première écriture de code de la session.
- Le comportement se règle dans la config du mod (une ligne dans `/config`).

## Non-buts

- Pas d'ouverture au démarrage de session ni à chaque tour.
- Pas de réglage de la largeur minimale : c'est le moteur qui la fixe.

## Anti-buts

- Un panneau qui revient après que le dev l'a fermé.
- Un panneau qui s'ouvre sur une session où aucun fichier n'est écrit.
- Un changement de comportement pour qui a déjà installé le mod sans toucher
  à sa config.

## Contraintes

- Un panneau ouvert sans demande du dev n'est dessiné qu'à partir de 144
  colonnes de terminal (110 pour un panneau que le dev a déjà ouvert une fois
  lui-même). En dessous, il est ouvert mais attend que le terminal s'élargisse.
- Un changement de l'option dans `/config` recharge le module : les variables
  du module repartent de zéro, `$.state` reste.

## Approches

- **A. À la première écriture de la session, une seule fois** — retenue par le
  dev. Le panneau arrive quand il y a quelque chose à lire, et le fermer le
  laisse fermé.
- **B. À chaque écriture si le panneau est fermé.** Écartée : fermer le panneau
  ne sert plus à rien.
- **C. Au démarrage de session.** Écartée : s'ouvre même sans code, panneau
  vide.

## Conception

**Option.** `plugin.json` gagne un `userConfig` avec un champ booléen
`autoOpen`, `false` par défaut (choix de Claude : ne rien changer pour les
installations existantes). `register` reçoit `options` et lit
`options.autoOpen === true`.

**Déclencheur.** Dans le hook `tool.call` existant, après `next(e)` :

- l'outil est `Edit`, `Write` ou `NotebookEdit` (choix de Claude : `Bash` est
  exclu du déclencheur, un `ls` ou un `git status` n'est pas du code écrit ;
  `Bash` continue de rafraîchir un panneau déjà ouvert) ;
- l'appel a réussi ;
- `autoOpen` est actif ;
- l'ouverture automatique n'a pas encore eu lieu dans cette session.

Alors : marquer l'ouverture comme faite, `$.ui.open({ id: PANE, title: TITLE })`,
puis `refresh($)`. Comme le rafraîchissement actuel, c'est lancé sans attendre
et sans jamais faire échouer l'appel d'outil.

Les écritures des sous-agents comptent (choix de Claude) : le hook ne filtre
pas sur `agentId`.

**Une fois par session.** Un booléen `hasAutoOpened` dans `$.state`, déclaré
dans `types/index.d.ts`. Il survit au rechargement du module, donc changer
l'option en cours de session ne rouvre pas un panneau déjà ouvert puis fermé.
Il est posé avant l'appel à `$.ui.open`, pour que deux écritures simultanées
n'ouvrent pas deux fois. Ouvrir à la main avec `/inspect` le pose aussi : un
panneau ouvert puis fermé par le dev ne revient pas.

**Largeur.** Si `$.ui.open` répond `isPlaced: false`, un toast le dit une fois :
panneau ouvert, terminal trop étroit, élargir ou taper `/inspect`.

## Tests

Dans `tests/pane.test.tsx`, avec `test(name, { options: { autoOpen: true } }, …)` :

- option active, premier `Edit` réussi : le panneau est ouvert et la liste est
  remplie ;
- option active, panneau fermé puis second `Edit` : il reste fermé ;
- option active, `Bash` seul : pas d'ouverture ;
- option active, `Edit` en échec : pas d'ouverture ;
- option absente (défaut) : pas d'ouverture.

## Documentation

README : une section sur l'option `autoOpen`, où la régler, et la limite de
largeur. Version du mod : 0.4.0.

## Laissé au constructeur

- La forme exacte du champ `userConfig` (libellé, description), validée par
  `claude plugin validate`.
- Le texte du toast.
