# Accueil et tableau de bord

L’accueil authentifié `/dashboard` réunit le suivi d’un budget et des synthèses globales. Sans choix dans l’URL, le budget créé le plus récemment est sélectionné automatiquement, brouillon compris ; les dates de création valides sont comparées et les égalités départagées par identifiant. Un choix explicite dans l’URL reste prioritaire, même s’il ne désigne plus un budget disponible. Le choix vide reste possible. L’exercice annuel et la référence de comparaison ne sont jamais déduits du libellé ou de la création. Les choix explicites de budget, année, référence et lot sont conservés dans l’URL. Changer de contexte annule les lectures précédentes. Chaque module a sa reprise après erreur ; une valeur indisponible reste « — ». Les liens utilisent la couleur de texte du thème Material, identique après visite, avec soulignement et focus visibles.

## Budget publié : recouvrement toutes dates

Les cotisations effectives incluent les ajustements tracés. Le réglé est le total des paiements moins les remboursements nets de leurs contre-écritures. Les lots sont comptés distinctement, même pour plusieurs copropriétaires ou un membre multi-lots.

- **Reste à encaisser** : somme des soldes positifs par lot.
- **Trop-perçus** : somme des excédents par lot, séparée du reste à encaisser.
- **Taux** : somme des montants couverts, plafonnés à l’appelé de chaque lot, divisée par l’appelé total. Sans appelé positif, aucun pourcentage n’est calculé.
- **Lots à jour** : soldés et trop-perçus. Les trop-perçus en sont un sous-ensemble ; ces compteurs ne sont pas à additionner.

Un excédent sur un lot ne compense jamais le manque d’un autre. Exemple : deux appels de 100 €, paiements de 120 € et 0 € donnent 100 € à encaisser, 20 € de trop-perçu et un taux de 50 %.

Les indicateurs ouvrent les cotisations avec un filtre visible. La carte conserve tous les états même si le tableau est filtré. La carte de l’accueil distingue soldé, partiel, sans paiement, trop-perçu et absence de cotisation ; la légende et le détail textuel complètent les couleurs. La sélection est possible au clavier ou avec le sélecteur de lot. Les paiements détaillés ne sont chargés que pour le lot choisi.

## Accueil allégé

À la demande de Thomas le 22 octobre 2026, les encaissements mensuels, leur graphique, leur tableau et le sélecteur d’année ont été retirés de l’accueil. Les quatre indicateurs de recouvrement toutes dates et la carte des paiements sont conservés. Le contrat API reste compatible avec les anciennes adresses contenant `year` ; ce paramètre n’est plus proposé comme choix dans l’interface.

La comparaison des budgets est repliée tant qu’aucune référence n’est choisie ; une référence dans l’URL l’ouvre automatiquement. Le choix d’un lot par liste et l’aide clavier sont regroupés sous la carte dans un volet dépliable. Les campagnes récentes et les explications secondaires se consultent aussi à la demande. Les erreurs, avertissements et points à traiter restent visibles.

## Brouillons et comparaison

Un brouillon montre l’aperçu existant : dépenses prévisionnelles, parts actuelles, annuel et mensuel par part sur douze mois. Il ne crée aucune cotisation. Une référence doit être choisie explicitement. La comparaison porte sur le total initial des dépenses, avec écart en euros et pourcentage seulement si la référence est positive.

Les parts des anciens exercices n’étant pas historisées, aucun ancien taux par part n’est inventé. Le caractère brouillon ou publié de chaque budget reste visible. **Actualiser** recharge l’aperçu après une modification des dépenses ou parts.

## Modules globaux

La qualité de l’annuaire compte les membres sans e-mail renseigné (espaces seuls compris), les lots sans membre actif et les lots dont les parts sont nulles ou négatives. Les liens ouvrent les listes complètes, sans correction automatique des données. Les filtres de qualité sur Lots et Membres ont été retirés à la demande de Thomas ; les anciens paramètres d’URL sont ignorés.

La synthèse des e-mails porte sur toutes les campagnes et tous les messages actifs, toutes dates. Les envois réussis incluent SENT et READ une seule fois. Le signal d’ouverture n’est pas une preuve de lecture humaine. Les états anciens inconnus sont regroupés dans « À vérifier ». La liste des campagnes ne propose plus de filtre d’état et ignore les anciens paramètres d’URL ; recherche, tri et pagination sont conservés. Le filtre d’état reste disponible dans les messages d’une campagne, avec des compteurs décrivant toujours l’ensemble de ses messages. Les cinq campagnes récentes et les agrégats SQL sont chargés sans corps ni pièces jointes.

Seuls les administrateurs reçoivent le compteur des demandes d’accès en attente. Il réutilise la politique de gestion des comptes : refus et désactivation ne sont pas des demandes en attente. Les API contrôlent également les droits ; masquer un lien n’est pas leur protection.

## Vérification

Les tests PostgreSQL couvrent centimes, remboursements, contre-écritures, lots distincts, copropriétaires, changement d’année à Paris et suppression logique. Les tests HTTP contrôlent authentification, accès et confidentialité. Angular/JSDOM vérifie les annulations, les erreurs indépendantes, les filtres destinations et le retrait des données administrateur. La revue des sources et le détecteur Impeccable ne certifient pas le rendu réel : vérifier visuellement mobile, thèmes clair/sombre et clavier dans la revue finale.
