# HoopStats

Application de saisie au bord du terrain pour Brignoles Basket Ball. L’**Accueil** donne accès au prochain match, à l’effectif, à l’historique et aux rapports. Lorsqu’un match est en cours, **Reprendre le match** rouvre sa saisie.

Dans **Équipe**, gérez les joueurs par nom d’affichage. La feuille de départ enregistre les convoqués et les détails du match. Le bouton **Cinq majeur** dans la saisie permet de choisir ou modifier les titulaires jusqu’au premier démarrage du chrono ou à la première action. Les convocations enregistrées restent indépendantes des modifications de l’effectif.

Dans **Matchs**, ouvrez une rencontre terminée pour afficher son **Box score**, son **Game flow** et son **Play-by-play**. **Export PDF** ouvre l’impression du box score et de la courbe. La corbeille de l’historique supprime la rencontre et ses actions après confirmation. L’onglet **Stats** présente le bilan d’équipe et de joueurs par saison à partir des matchs validés.

## Lancer le prototype

Avec Node.js 22.18 ou ultérieur, depuis le dossier du projet :

```powershell
npm.cmd ci
npm.cmd run dev
```

Sur l’ordinateur, ouvrez [localhost:5173/hoopstats/](http://localhost:5173/hoopstats/). Pour essayer la saisie sur un smartphone connecté au même réseau que l’ordinateur :

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Ouvrez sur le téléphone l’adresse **Network** affichée par Vite. Si Windows affiche une demande du pare-feu, autorisez l’accès sur votre réseau privé. Cette adresse HTTP convient à la recette de saisie. Pour installer l’application et vérifier le mode avion sur un téléphone, servez la compilation sur une adresse HTTPS. Les matchs sont enregistrés par navigateur et par adresse.

## Transférer les données vers GitHub Pages

Dans la version locale, ouvrez **Équipe → Sauvegarde des données → Exporter la sauvegarde**. Ouvrez ensuite la [version en ligne](https://guillaumefoot.github.io/hoopstats/#equipe) et choisissez **Importer une sauvegarde** au même endroit. Le fichier transfère l’effectif et les matchs enregistrés. L’import ajoute les éléments absents de la base du navigateur.

## Recette rapide

1. Dans un profil de navigateur réservé aux tests, ouvrez **Accueil → Nouveau match**. Renseignez l’adversaire, sélectionnez cinq titulaires et convoquez au moins deux remplaçants. Ouvrez la saisie. Sélectionnez un joueur puis **+2**. Le score monte de deux points.
2. Sélectionnez **Adversaire**, puis **+2**. Resélectionnez **Adversaire**, puis **3 raté** pour enregistrer une tentative sans modifier le score. Dans les actions récentes, ouvrez **+ Passe** sur le panier de votre équipe et choisissez un passeur.
3. Sélectionnez un joueur, puis tapez deux fois **LF +1**. Le joueur reste sélectionné. Essayez ensuite **Annuler**.
4. Dans **Réglages**, passez en **Essentiel**, puis en **Complet**. Revenez à la saisie pour voir les boutons supplémentaires sous les tirs.
5. Ouvrez **Rotation**, sélectionnez deux sortants et deux entrants, puis validez. **Annuler** rétablit les cinq joueurs d’un coup. Rechargez la page pour vérifier la reprise.
6. Dans **Stats**, vérifiez la différence entre **—** pour un indicateur non suivi, **0** pour un indicateur suivi et la mention **partiel** si le suivi a changé pendant le match.
7. Lancez le chrono avec **▶**, mettez-le en pause, puis reprenez. Touchez le temps affiché pour le recaler. Changer de période met en pause celle que vous quittez. Choisissez **P1** dans le sélecteur pour lancer le chrono d’une première prolongation à **5:00**.
8. À **00:00** en fin de Q4 ou d’une prolongation, **Valider le match** ouvre le rapport. En cas d’égalité, lancez la prolongation proposée. Le rapport permet de **Rouvrir la saisie** pour une correction.

## Vérifier et compiler

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Les tests couvrent les calculs, les règles de saisie, les passes, les rotations et les transactions IndexedDB. La compilation génère `dist/` avec le manifeste et le service worker. Pour vérifier le cache sur ordinateur, ouvrez l’aperçu de production une première fois en ligne, rechargez pour activer le contrôle du service worker, puis coupez le réseau et rechargez à nouveau.

Le modèle de match et les calculs de saisie sont dans `src/basket.ts`. `src/store.ts` enregistre chaque changement avec une transaction IndexedDB. `src/matchReport.ts` calcule les rapports à partir des actions et des rotations. La corbeille supprime une action récente pour permettre de la ressaisir. **Annuler** la restaure à sa place.
