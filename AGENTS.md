# HoopStats — Instructions permanentes du projet Codex

## 1. Contexte du projet

**HoopStats** est une application web PWA dédiée au suivi statistique des matchs de basketball amateur.

L'objectif est de disposer d'un outil rapide, ergonomique, personnalisable et utilisable principalement sur smartphone par une seule personne pendant un match.

Le projet dispose déjà d'un **premier prototype développé localement**. Il ne faut donc pas repartir de zéro.

Avant toute modification :
- Examiner la structure du projet existant.
- Identifier les fonctionnalités déjà implémentées.
- Repérer les éléments fonctionnels à conserver.
- Identifier les éventuels écarts avec le cahier des charges.
- Privilégier l'amélioration et la réutilisation du code existant plutôt qu'une réécriture complète.

Ne jamais écraser ou remplacer le prototype existant sans justification et validation explicite.

## 2. Dépôt GitHub

- **Repository :** `guillaumefoot/hoopstats`
- **URL :** https://github.com/guillaumefoot/hoopstats
- **Branche principale :** `main`
- **Hébergement cible :** GitHub Pages
- **URL de production :** https://guillaumefoot.github.io/hoopstats/
- **Base Vite :** `/hoopstats/`

Le dépôt GitHub est la destination du projet.

Si le prototype local n'a pas encore été synchronisé avec GitHub, commencer par vérifier son état et proposer la procédure adaptée pour le publier sans perdre les fichiers existants.

Ne jamais supposer que le dépôt distant contient déjà les modifications locales.

Respecter le workflow Git sélectionné dans Codex. Ne pas effectuer de push, de fusion ou de modification destructive sans autorisation.

## 3. Stack technique

Stack cible :

- React
- TypeScript
- Vite
- PWA avec service worker
- IndexedDB pour le stockage local
- GitHub Pages pour l'hébergement
- GitHub Actions pour le déploiement

Ces choix constituent la cible technique, mais il faut d'abord inspecter les technologies réellement utilisées dans le prototype.

Ne pas introduire de framework supplémentaire, de backend ou de dépendance lourde sans nécessité.

L'application doit pouvoir fonctionner hors ligne après son installation et conserver les statistiques localement.

## 4. Référence fonctionnelle

Le cahier des charges HoopStats présent dans le projet constitue la référence fonctionnelle.

Les principes prioritaires sont :

- Interface mobile-first, rapide et lisible.
- Utilisation efficace par une seule personne.
- Cinq joueurs présents sur le terrain et une ligne collective adverse.
- Trois modes de saisie : Offensif, Essentiel et Complet.
- Gestion rapide des rotations.
- Affichage compact des trois dernières actions.
- Ajout différé des passes décisives sur les paniers.
- Correction et annulation des actions.
- Sauvegarde automatique locale.
- Statistiques individuelles et collectives.
- Box scores et historique de saison.

La simplicité de saisie prime sur la multiplication des fonctionnalités.

Ne pas développer de nouvelles fonctionnalités non demandées sans justification.

## 5. Priorités de développement

Privilégier dans cet ordre :

1. Fiabilité de la saisie et des données.
2. Ergonomie mobile et rapidité d'utilisation.
3. Correction des actions et gestion des rotations.
4. Fonctionnement hors ligne et persistance.
5. Statistiques, visualisations et exports.
6. Personnalisation visuelle et fonctionnalités avancées.

Conserver une architecture modulaire afin de faciliter les évolutions futures.

Éviter les refactorisations importantes lorsqu'une modification ciblée suffit.

## 6. Optimisation des tokens et utilisation des sous-agents

L'objectif est de réduire la consommation globale de tokens, de préserver le contexte principal et d'optimiser le coût des tâches.

### Choix des modèles

- **Privilégier des modèles plus légers, plus rapides et moins coûteux que le modèle principal pour les sous-agents.**
- Utiliser le modèle le moins coûteux capable de réaliser correctement la tâche.
- Réserver le modèle principal aux décisions complexes, à l'architecture, à l'intégration et aux problèmes difficiles.
- Ne pas utiliser un sous-agent de même niveau que l'agent principal pour une tâche simple si une alternative plus économique existe.
- Si le choix du modèle des sous-agents n'est pas configurable, ne pas prétendre avoir appliqué cette optimisation.

### Délégation

Utiliser les sous-agents lorsque cela présente un réel intérêt.

Tâches adaptées :
- Exploration ciblée du dépôt.
- Recherche de fichiers ou de fonctions.
- Analyse de dépendances.
- Audits simples.
- Vérifications techniques.
- Revue de code.
- Documentation.
- Tests indépendants.

Pour chaque délégation :
- Définir une mission précise et limitée.
- Fournir uniquement le contexte nécessaire.
- Demander un résultat court, concret et exploitable.
- Éviter les recherches redondantes.
- Limiter les délégations en cascade.

Paralléliser les tâches indépendantes uniquement si le gain justifie le coût supplémentaire.

Ne pas créer de sous-agent lorsqu'une tâche peut être réalisée directement et plus efficacement.

### Gestion du contexte

- Lire seulement les fichiers nécessaires.
- Privilégier les recherches ciblées.
- Ne pas charger inutilement de longs fichiers.
- Éviter de répéter les informations déjà connues.
- Résumer les résultats des investigations.
- Conserver la coordination et l'intégration finale dans l'agent principal.

**Règle générale : minimiser le coût total de la tâche, pas seulement les tokens consommés par l'agent principal.**

## 7. Qualité et vérifications

Pour chaque modification significative :

- Respecter les conventions existantes du projet.
- Préserver les fonctionnalités déjà opérationnelles.
- Éviter la complexité inutile.
- Vérifier les types TypeScript.
- Exécuter les tests pertinents lorsqu'ils existent.
- Vérifier la compilation.
- Tester les comportements concernés par les modifications.

Ne pas affirmer qu'un test a réussi s'il n'a pas été exécuté.

Pour les modifications PWA, vérifier les chemins de ressources, le manifest et la compatibilité avec GitHub Pages.

## 8. Communication et autonomie

Travailler de manière autonome sur les tâches clairement définies.

Ne demander une validation que lorsqu'une décision importante, ambiguë ou potentiellement destructive doit être prise.

À la fin de chaque tâche, fournir un compte rendu concis comprenant :

- Les modifications effectuées.
- Les fichiers principaux concernés.
- Les tests réalisés et leurs résultats.
- Les éventuels problèmes restants.
- Les prochaines étapes pertinentes.

Éviter les comptes rendus inutilement longs.

## 9. Principes fondamentaux

**Ne pas repartir de zéro.**

**Préserver et améliorer le prototype existant.**

**Privilégier l'ergonomie et la fiabilité plutôt que la complexité.**

**Utiliser les sous-agents légers lorsque cela apporte un gain réel.**

**Maintenir le projet compatible avec GitHub Pages et une utilisation mobile hors ligne.**