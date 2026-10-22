# ASL Bissieux

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

L’application sert à gérer l’Association Syndicale Libre de Bissieux. Les comptes activés disposent de droits par action ; certaines fonctions sont réservées aux administrateurs. Un membre de l’annuaire et un utilisateur de l’application sont deux notions distinctes.

## Product Purpose

Gérer les membres et leurs lots, les budgets, les cotisations et paiements, les campagnes d’e-mails et les listes de diffusion de l’association. Faciliter la consultation et les actions de gestion en conservant une lecture exacte des données.

## Operating Context

L’interface est en français. La carte SVG du lotissement représente 42 lots. Thomas demande explicitement de la conserver pour visualiser rapidement l’état des paiements et de pouvoir rechercher directement depuis la carte. La refonte doit rendre le site plus moderne et moins austère ; les composants et le framework peuvent changer si nécessaire.

## Capabilities and Constraints

- Préserver les fonctions, données et droits existants, ainsi que la connexion Google OIDC locale.
- Conserver les états financiers distincts : soldé, partiellement réglé, sans paiement, trop-perçu et sans cotisation. Le violet identifie le trop-perçu ; la sélection et le focus de la carte restent distincts de ces états.
- Respecter les calculs au centime, la distinction brouillon/publié, les remboursements et leur historique.
- Conserver la séparation préparation/envoi des campagnes et les états d’envoi incertains.
- Les listes OVH sont configurées avec Viper et des variables d’environnement ; les appels de développement passent par Smocker.
- Le dernier budget créé est sélectionné par défaut, sauf choix explicite dans l’URL.
- Les boutons d’ajout restent compacts avec une icône +, un nom accessible et une infobulle, sans texte visible à côté.
- Les changements sont commités par intention ou fonctionnalité, puis vérifiés dans le déploiement Docker Compose local. La validation humaine finale appartient à Thomas.

## Evidence on Hand

Le code métier et ses tests, les écrans de gestion en français et la carte SVG existante constituent les sources. La fiche de validation dans docs/fiche-validation.md couvre les lots fonctionnels antérieurs. Les données utilisées dans les propositions visuelles doivent être indiquées comme fictives ; aucun montant de démonstration ne doit être présenté comme une donnée réelle de l’association.

## Product Principles

- Donner un accès rapide à la situation des paiements depuis la carte et sa recherche.
- Présenter clairement les actions, leur portée et leurs conséquences.
- Conserver l’exactitude financière et les distinctions métier lors de toute simplification visuelle.
- Offrir une interface cohérente sur ordinateur et mobile, utilisable au clavier.

## Open Decisions

La nouvelle identité visuelle reste à choisir sur une proposition concrète. Aucun remplacement de framework n’est imposé : son intérêt doit être justifié par le résultat et les contraintes existantes.
