# Ajustements et remboursements après publication

Les dépenses et cotisations initiales restent conservées. Dans l’historique d’une
cotisation, le bouton + permet d’ajouter un paiement, d’enregistrer un remboursement
déjà effectué, ou d’ajuster le montant appelé pour ce lot. Les nouveaux droits
`budget.CreateRefund` et `budget.CreateAdjustment` sont attribuables séparément ;
les administrateurs actifs les possèdent.

Un remboursement est un enregistrement comptable : aucun virement bancaire ni
message n’est envoyé. Son montant positif ne peut pas dépasser le trop-perçu
actuel du lot dans le budget sélectionné. Les remboursements partiels sont permis.
Aucun report sur un autre budget n’est automatique.

Un ajustement est un supplément ou une réduction de l’appel de cette cotisation,
avec date, motif obligatoire, référence facultative et auteur. Le montant appelé
effectif ne peut pas devenir négatif. Le budget garde son total de dépenses
initial ; son total appelé effectif est la somme des cotisations ajustées.

Chaque opération exige un aperçu avant confirmation. Une situation modifiée entre
l’aperçu et l’enregistrement impose une nouvelle prévisualisation. Le journal est
immuable en base ; une annulation ajoute une contre-écriture liée à l’original.
On ne peut annuler deux fois une opération ni annuler une contre-écriture.
Annuler un remboursement dans le journal ne récupère aucun argent en banque.

Les soldes, états, carte et nouveaux contextes d’e-mails utilisent l’appelé effectif
et l’encaissé net (paiements moins remboursements, contre-écritures comprises).
Les anciens contextes de campagnes restent conservés. Les trop-perçus des autres
lots ne diminuent pas le reste à encaisser d’un lot débiteur.

Toutes les écritures financières verrouillent le budget pendant leur transaction.
Modifier/supprimer un paiement reste permis selon les droits existants, sauf si
cela réduit les paiements au-dessous des remboursements nets déjà enregistrés.
Il faut alors d’abord corriger le remboursement par contre-écriture.

## Migration et vérification

Migration additive `0005_financial_ledger.sql`, à appliquer selon la procédure de
sauvegarde et de restauration décrite dans le guide des migrations. Elle ne change
aucun montant historique. Les tests PostgreSQL couvrent les limites de montant,
les remboursements partiels/complets, les contre-écritures, l’immutabilité SQL,
les requêtes concurrentes, les aperçus périmés et les permissions HTTP.

Pour une revue finale, utiliser un budget fictif publié : appeler 100 €, saisir
150 € de paiements, enregistrer 20 € puis 30 € de remboursements. Le lot passe
de 50 € à rembourser à soldé. Une saisie supplémentaire doit être refusée.
Annuler les 20 € par contre-écriture conserve les deux lignes et rétablit 20 €
à rembourser. Tester ensuite supplément et réduction avec leur aperçu.
