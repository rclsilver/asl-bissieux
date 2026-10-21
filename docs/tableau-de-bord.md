# Accueil et tableau de bord

L’accueil authentifié `/dashboard` réunit le suivi d’un budget explicitement choisi et des synthèses globales. Aucun budget n’est déduit de son libellé ni de sa date de création. Budget, année civile, référence de comparaison et lot sélectionné sont conservés dans l’URL. Changer de contexte annule les lectures précédentes. Chaque module a sa reprise après erreur ; une valeur indisponible reste « — ».

## Budget publié : recouvrement toutes dates

Les cotisations effectives incluent les ajustements tracés. Le réglé est le total des paiements moins les remboursements nets de leurs contre-écritures. Les lots sont comptés distinctement, même pour plusieurs copropriétaires ou un membre multi-lots.

- **Reste à encaisser** : somme des soldes positifs par lot.
- **Trop-perçus** : somme des excédents par lot, séparée du reste à encaisser.
- **Taux** : somme des montants couverts, plafonnés à l’appelé de chaque lot, divisée par l’appelé total. Sans appelé positif, aucun pourcentage n’est calculé.
- **Lots à jour** : soldés et trop-perçus. Les trop-perçus en sont un sous-ensemble ; ces compteurs ne sont pas à additionner.

Un excédent sur un lot ne compense jamais le manque d’un autre. Exemple : deux appels de 100 €, paiements de 120 € et 0 € donnent 100 € à encaisser, 20 € de trop-perçu et un taux de 50 %.

Les indicateurs ouvrent les cotisations avec un filtre visible. La carte conserve tous les états même si le tableau est filtré. La carte de l’accueil distingue soldé, partiel, sans paiement, trop-perçu et absence de cotisation ; la légende et le détail textuel complètent les couleurs. La sélection est possible au clavier ou avec le sélecteur de lot. Les paiements détaillés ne sont chargés que pour le lot choisi.

## Encaissements mensuels

Le graphique et le tableau représentent les mêmes douze mois de l’année civile sélectionnée, dans le fuseau **Europe/Paris**. La date métier du paiement est utilisée, jamais sa date de création technique. Un paiement modifié ou supprimé est reflété à l’actualisation. Les remboursements datés et leurs contre-écritures sont inclus avec leur signe.

Le cumul part de zéro en janvier de cette année ; il peut devenir négatif. Il ne représente pas une trésorerie bancaire. La ligne pointillée compare ce cumul à l’appelé actuel toutes dates : elle ne prétend pas reconstruire un appelé historique. Les indicateurs de recouvrement restent toutes dates et ne changent pas de période avec ce graphique.

## Brouillons et comparaison

Un brouillon montre l’aperçu existant : dépenses prévisionnelles, parts actuelles, annuel et mensuel par part sur douze mois. Il ne crée aucune cotisation. Une référence doit être choisie explicitement. La comparaison porte sur le total initial des dépenses, avec écart en euros et pourcentage seulement si la référence est positive.

Les parts des anciens exercices n’étant pas historisées, aucun ancien taux par part n’est inventé. Le caractère brouillon ou publié de chaque budget reste visible. **Actualiser** recharge l’aperçu après une modification des dépenses ou parts.

## Modules globaux

La qualité de l’annuaire compte les membres sans e-mail renseigné (espaces seuls compris), les lots sans membre actif et les lots dont les parts sont nulles ou négatives. Les liens ouvrent les listes avec le filtre affiché, sans correction automatique des données.

La synthèse des e-mails porte sur toutes les campagnes et tous les messages actifs, toutes dates. Les envois réussis incluent SENT et READ une seule fois. Le signal d’ouverture n’est pas une preuve de lecture humaine. Les états anciens inconnus sont regroupés dans « À vérifier ». Une campagne filtrée contient au moins un message de l’état demandé ; ses compteurs décrivent toujours l’ensemble de ses messages. Les cinq campagnes récentes et les agrégats SQL sont chargés sans corps ni pièces jointes.

Seuls les administrateurs reçoivent le compteur des demandes d’accès en attente. Il réutilise la politique de gestion des comptes : refus et désactivation ne sont pas des demandes en attente. Les API contrôlent également les droits ; masquer un lien n’est pas leur protection.

## Vérification

Les tests PostgreSQL couvrent centimes, remboursements, contre-écritures, lots distincts, copropriétaires, changement d’année à Paris et suppression logique. Les tests HTTP contrôlent authentification, accès et confidentialité. Angular/JSDOM vérifie les annulations, les erreurs indépendantes, les filtres destinations et le retrait des données administrateur. La revue des sources et le détecteur Impeccable ne certifient pas le rendu réel : vérifier visuellement mobile, thèmes clair/sombre et clavier dans la revue finale.
