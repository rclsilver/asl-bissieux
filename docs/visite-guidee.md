# Visite guidée versionnée

La visite est facultative et disponible pour les comptes actifs. Elle propose des exemples fictifs adaptés aux droits du compte connecté. Le catalogue livré est en **version 1**.

## Utilisation

Une invitation apparaît lorsqu’au moins un chapitre disponible n’a pas encore été parcouru dans sa révision actuelle. **Découvrir le site** ou **Voir les nouveautés** ouvre le parcours restant. **Plus tard** masque seulement l’invitation pendant la session applicative courante : ce choix n’est pas enregistré comme une visite effectuée. Un rechargement de l’application, une reconnexion, un changement de compte ou un rafraîchissement des droits peut proposer de nouveau la visite.

- `/tour` et `/tour?mode=updates` présentent uniquement les chapitres nouveaux ou modifiés pour ce compte.
- Le menu du compte, **Revoir la visite guidée**, ouvre `/tour?mode=all` et permet de tout revoir.
- **Suivant** et **Terminer la visite** enregistrent le chapitre courant avant de continuer. **Précédent**, **Reprendre plus tard** et **Quitter la visite** ne valident pas le chapitre courant.
- Une erreur d’enregistrement conserve l’étape affichée et permet de réessayer. Si le catalogue a changé, il faut le recharger.

Les chapitres déjà validés restent acquis entre les sessions. Revoir une étape déjà acquise ne réécrit pas sa progression. Le rechargement du catalogue ou des droits reconstruit le parcours ; changer de mode annule la continuation d’un enregistrement de l’ancien parcours.

## Contenu selon les droits

| Chapitre | Disponibilité |
| --- | --- |
| Prendre ses repères | Tout compte actif |
| Retrouver un membre depuis son lot | Tout compte actif |
| Comprendre le budget et les cotisations | Tout compte actif |
| Enregistrer un règlement | Droit `budget.CreatePayment` |
| Suivre les e-mails de l’association | Tout compte actif |
| Accueillir un nouvel utilisateur | Administrateur |
| Mettre à jour les listes de diffusion | Administrateur |

Les quatre chapitres communs permettent la découverte en consultation. Le serveur filtre aussi les capacités des exemples : création/modification de membres, modification de lots, préparation/publication de budgets, préparation/envoi d’e-mails, remboursement et ajustement apparaissent selon les autorisations correspondantes. Administrateur dispose de toutes les actions.

Les interactions utilisent des données locales : membres fictifs, adresses `example.invalid`, budget et montants d’exemple. Elles ne créent aucun membre, paiement, budget, e-mail ou abonnement OVH. Seule la progression de visite appelle une écriture serveur. L’exemple d’annuaire conserve notamment les copropriétaires d’un même lot et les membres possédant plusieurs lots.

## API et stockage

Le catalogue et ses règles résident dans `pkg/tour/tour.go`. L’interface et ses exemples résident dans `frontend/src/app/tour/`.

- `GET /api/auth/tour` renvoie `version`, `seen_version` et les étapes autorisées avec leur `revision`, `seen_revision`, leurs capacités et leurs notes de changement.
- `POST /api/auth/tour/progress` reçoit `version`, `step_id`, `revision`, puis renvoie l’état actualisé. L’utilisateur provient de la session authentifiée ; le client ne choisit pas le compte à modifier.

La migration `0008_guided_tour.sql` ajoute `tour_version` à la table `user` et crée `auth_tour_progress`. Chaque ligne de progression est identifiée par `(user_id, step_id)` et contient la révision acquise et sa date. Une suppression SQL définitive du compte supprime ses lignes associées ; la suppression applicative reste logique et interdit l’accès sans effacer cet historique.

`auth.User.TourVersion` est un résumé : il atteint la version courante après validation de tous les chapitres actuellement visibles. La décision de proposer une étape repose sur sa progression propre, et non sur ce résumé seul. De nouveaux droits peuvent donc révéler un chapitre encore inédit dans la même version.

Chaque enregistrement relit le compte et ses droits en transaction, verrouille sa ligne et vérifie la version exacte du catalogue ainsi que la révision et la visibilité de l’étape. Une version obsolète est refusée avec HTTP 409 ; une étape ou révision indisponible avec HTTP 400. Un compte inactif ne peut pas utiliser ces endpoints. La progression n’abaisse jamais une révision déjà acquise et ne modifie pas la date de mise à jour des autorisations du compte.

## Publier une évolution du parcours

1. Incrémenter `Version` dans `pkg/tour/tour.go` pour la nouvelle livraison du parcours.
2. Pour chaque chapitre modifié ou ajouté, fixer `revision` au numéro de cette nouvelle version. Conserver la révision des chapitres inchangés et les identifiants stables des chapitres existants.
3. Ajouter une entrée dans `changes` pour chaque changement à expliquer, avec `version` et un texte utilisateur concret. Conserver les notes antérieures : seules celles postérieures à la révision acquise sont renvoyées.
4. Mettre à jour les exemples Angular dans la même livraison et vérifier leurs conditions de droits. Les nouvelles interactions doivent rester locales et fictives.
5. Vérifier qu’un compte ayant terminé l’ancienne version ne reçoit que les chapitres touchés, qu’un nouveau compte peut tout parcourir et qu’un changement de droits révèle les étapes appropriées.

La révision d’un chapitre correspond à la version de sa dernière modification : ce n’est pas un compteur indépendant. Par exemple, dans une future version 3, un chapitre resté à la révision 1 passe directement à 3 s’il change. Cette règle permet de comparer correctement les notes de changement à la progression acquise.

## Vérification et cohérence visuelle

Les tests backend couvrent le filtrage des chapitres et capacités, les différences entre versions simulées, la persistance isolée par compte, les requêtes concurrentes, les droits relus à l’écriture et le contrat HTTP. Les versions 2 et 3 présentes dans les scénarios sont des simulations ; elles ne désignent pas des versions déjà livrées.

Les tests Angular couvrent l’invitation facultative, le report, la reprise, les erreurs, les transitions de mode, le rechargement du catalogue, les changements de compte/droits et les interactions fictives sans appel métier. Les vérifications backend ont été effectuées avec un PostgreSQL jetable. La migration locale a fait l’objet d’une sauvegarde et d’une comparaison préservant les données métier existantes.

La comparaison sur sources avec `DESIGN.md` confirme la réutilisation des couleurs sémantiques `--asl-*`, du rayon de surface, des boutons/champs/onglets Material et de la carte existante. Les titres héritent de la typographie globale ; les contrôles conservent une cible minimale de 44 px, le contenu se replie en une colonne sous 800 px et les tableaux restent défilants. Le focus des titres, les messages de statut et d’erreur sont explicités dans le balisage. Le scan Impeccable du périmètre modifié n’a signalé aucun motif (`[]`).

Cette extension conserve `DESIGN.md` et son sidecar sans les réécrire. Aucun écart préexistant nécessitant une réparation n’a été établi dans le périmètre examiné. Ces constats portent sur les sources : aucune capture ni inspection dans un navigateur n’a été réalisée. La validation du rendu ordinateur/mobile, des deux thèmes et de la navigation au clavier reste humaine ; le verdict visuel demeure « recapture » faute de captures autorisées dans cet environnement.
