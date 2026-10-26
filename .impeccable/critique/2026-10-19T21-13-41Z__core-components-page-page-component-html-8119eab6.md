---
target: Connexion, navigation et parcours représentatifs ASL
total_score: 21
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 5
target_identity: "file:/home/thomas.betrancourt/Documents/Work/asl-bissieux/frontend/src/app/core/components/page/page.component.html"
target_fingerprint: "sha256:5cee9e0fe4306da6dc9c569e578a797d7dcdfe277b88bfab959644fa6855fba6"
target_path: /home/thomas.betrancourt/Documents/Work/asl-bissieux/frontend/src/app/core/components/page/page.component.html
timestamp: 2026-10-19T21-13-41Z
slug: core-components-page-page-component-html-8119eab6
---
Method: dual-agent (A: ux_design_review · B: ux_detector_review)

Revue documentaire initiale du lot 9, fondée sur les sources Angular de la connexion, navigation, tableaux, budgets et e-mails. Aucun rendu navigateur ni contraste visuel certifié : les consignes de cet environnement interdisent d’ouvrir un navigateur. Les scores ne sont pas des mesures de l’interface rendue.

## Spécificité et méthode

L’interface Material constitue une base familière pour un outil de gestion. La spécificité ASL se retrouve dans les budgets, les parts et la carte, mais les commandes génériques et le mélange français/anglais l’effacent dans les parcours. La précision et la cohérence des tâches priment ici sur une rupture graphique. Mode de la surface : Operate.

A a examiné les sources sans détecteur. B a ensuite transmis les résultats indépendants du moteur Impeccable : quatre templates scannés, zéro constat automatisé (JSON []). Cibles : page.component.html, crud-table.component.html, budget-details.component.html et email-sending-popup.component.html. Les fichiers JSON et stderr sont conservés dans le scratch de session sous assessment-b-*. Aucun faux positif à arbitrer. Le résultat source vide ne certifie pas les noms accessibles ou le comportement de l’Angular rendu. Aucun navigateur, serveur de critique, overlay ou capture n’a été ouvert.

## Évaluation indicative

| Heuristique | Score /4 | Constats |
|---|---:|---|
| Visibilité de l’état | 3 | Connexion, publication et progression explicites ; annonces à vérifier |
| Correspondance avec le réel | 2 | Concepts ASL présents, français/anglais mélangés |
| Contrôle et liberté | 2 | Annulation/arrêt présents ; retours de parcours peu explicites |
| Cohérence et standards | 2 | Material partagé ; vocabulaire et commandes divergents |
| Prévention des erreurs | 3 | Publication figée, renvoi prudent, contrôles et permissions |
| Reconnaissance plutôt que mémoire | 2 | Actions importantes derrière des icônes |
| Souplesse et efficacité | 2 | Tri/filtres/sélection ; accélérateurs non constatés |
| Minimalisme et hiérarchie | 2 | Connexion éloignée de l’explication, commandes génériques |
| Récupération des erreurs | 2 | Authentification expliquée ; HTTP/JSON techniques ailleurs |
| Aide contextuelle | 1 | Tooltips et explications locales, aide orientée tâche non constatée |
| **Total** | **21/40** | **Acceptable, améliorations importantes nécessaires** |

Tous les critères s’appliquent. Les contrastes, débordements et parcours clavier devront être vérifiés visuellement dans un environnement autorisant cette inspection.

## Forces à conserver

- Conséquences de publication d’un budget expliquées : dépenses/cotisations figées, paiements encore modifiables.
- Distinction entre vérification de session, connexion et activation en attente.
- Suivi d’envoi détaillé, possibilité d’arrêt et traitement prudent des résultats incertains.

## Problèmes prioritaires

1. **P1 — Connexion : explication et action éloignées.** `frontend/src/app/core/components/page/page.component.html:14` place le bouton dans la toolbar, mais `:81` affiche l’instruction sans action. Le bouton de menu mobile peut ouvrir un tiroir vide avant connexion. Regrouper le titre, l’explication et le CTA dans le contenu, masquer la navigation sans accès et conserver OIDC. Le composant Google n’est utilisé qu’en mode Google transitoire ; OIDC utilise le bouton applicatif.
2. **P1 — Vocabulaire mixte.** `page.component.ts:40`, `emails.component.ts:14` et `budget-list.component.ts:100` mélangent Units/Members/Users/Campaigns/Templates/Label/Draft. Stabiliser Lots, Membres, Utilisateurs, Campagnes, Modèles, Libellé, Brouillon.
3. **P1 — Actions cachées et noms accessibles insuffisants.** `shared/components/crud-table/crud-table.component.html:39` emploie un + générique ; `:91` et `:99` n’explicitent pas le nom des sélections ; `:113` ouvre un menu de ligne sans nom explicite. Nommer les actions et sélections, contextualiser l’action principale et conserver le menu pour les actions secondaires. Le comportement réel reste à vérifier dans l’arbre d’accessibilité.
4. **P1 conditionnel — Mobile incomplet dans le code.** `page.component.html:30` n’encadre pas un nom long et `:55` ne ferme pas le tiroir après choix. `email-list.component.ts:85` et `:322` utilisent des dialogues à 50 %. Prévoir le repli du compte et la fermeture du tiroir, puis contrôler les tableaux et dialogues à 360–390 px et au zoom. Aucun débordement n’a été observé : il s’agit de risques issus des sources.
5. **P1 — Préparation des e-mails technique.** `budget-email-form.component.html:35` expose Data/JSON, et `:89` des options anglaises peu explicites. Le TS parse le JSON et crée les e-mails ; il ne les envoie pas directement. Guider la personnalisation, clarifier les destinataires et séparer préparation et envoi réel dans un lot dédié.

## Charge cognitive, parcours et personas

Le principal coût est la traduction mentale, les actions cachées et les changements de contexte. Quatre destinations pour un utilisateur actif, cinq pour un administrateur : mieux différencier l’administration plutôt que regrouper artificiellement cinq destinations familières. L’aperçu budgétaire donne quatre métriques utiles ; préserver la précision en donnant la priorité au résultat et à l’action.

L’entrée actuelle présente une restriction avant le prochain geste ; la publication explicitée rétablit la confiance ; les données techniques de préparation d’e-mail la fragilisent ; le suivi détaillé d’envoi rassure.

- Novice : bouton éloigné, distinction Members/Users et code d’icônes à apprendre.
- Clavier/lecteur d’écran : noms des contrôles à compléter, absence de lien d’évitement et de main, état actif sans aria-current.
- Mobile : tiroir vide possible, fermeture non prévue après navigation, nom long et dialogues étroits à contrôler.

Observations secondaires : les états vides n’indiquent pas s’il faut créer, effacer un filtre ou réessayer ; les erreurs exposent HTTP/status. Les contrôles Material apportent des standards, sans garantir seuls l’accessibilité complète.

## Proposition de premier lot

Connexion et navigation : bloc d’entrée dédié avec CTA contextualisé et états cohérents, vocabulaire français, zone compte adaptée, navigation active sémantique, tiroir pertinent et fermeture après choix, accès rapide au contenu et structure main. S’appuyer sur le thème existant. Reporter tableaux et formulaires métier dans des lots distincts.

Contrôles : retour à la route demandée, session expirée, compte inactif, nom long, clavier, mobile/bureau, thèmes clair et sombre. La vérification rendue reste à effectuer par un environnement autorisé et lors de la validation utilisateur.

Questions transmises via Threavia : priorité du lot (connexion/navigation, tableaux/actions ou préparation e-mails) ; priorité mobile (consultation/navigation, paiements compris ou toute la gestion).
