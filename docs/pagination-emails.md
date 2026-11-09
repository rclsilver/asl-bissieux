# Historique paginé des e-mails

Le périmètre a été confirmé par Thomas : recherche par destinataire et filtre d’état. Les objets et les corps ne sont plus des critères de recherche. Le message complet reste consultable à la demande.

## API

GET /api/email/campaigns/{campaign_id}/emails renvoie désormais {items,total,page,page_size}, à la place du tableau complet. Défaut : page 1, 25 lignes ; maximum : 100 lignes. Le contrat et le client Angular sont mis à jour ensemble.

La recherche query porte sur le destinataire, sans distinction de casse, avec % et _ littéraux et une limite de 200 caractères. state accepte WAITING, SENDING, SENT, READ, ERROR ou UNKNOWN ; son absence conserve tous les états. sort accepte created_at, to et state, avec direction asc/desc. Le tri par défaut est created_at décroissant, puis UUID décroissant. Les paramètres invalides renvoient 400 et une campagne absente renvoie 404. Une page devenue inexistante est ramenée à la dernière page.

Les résumés contiennent seulement identifiant, date de préparation, destinataire, objet, état et indicateur d’erreur. Ni corps, ni contexte de personnalisation, ni pièce jointe ne sont sérialisés dans cette réponse. Seuls les objets des WAITING/ERROR de la page sont calculés ; les objets déjà envoyés restent conservés. Ce calcul partage la priorité des contextes avec l’aperçu complet, les données de campagne remplaçant celles du message à clé égale.

La liste ne valide pas tout le corps du modèle. Un objet impossible à préparer reste visible comme indisponible, sans masquer les autres lignes. L’aperçu ou l’envoi contrôle le rendu complet.

GET /api/email/{email_id} conserve l’aperçu complet existant. GET /api/email/{email_id}/status fournit uniquement identifiant, état et erreur d’envoi enregistrée, sans exécuter le modèle. Les deux lectures exigent un utilisateur authentifié et actif.

## Sélections et actions

La sélection est limitée à la page affichée. Elle est effacée immédiatement au chargement ou à la saisie d’un nouveau filtre. La requête précédente est annulée immédiatement ; seul le départ de la nouvelle recherche est retardé de 250 ms.

Pendant le chargement, les anciennes lignes sont inertes au clavier et à la souris. La recherche reste utilisable. Les méthodes d’action vérifient également que les lignes appartiennent toujours à la page active et que la liste n’est pas occupée.

Chaque confirmation capture une copie des lignes avant ouverture. Une confirmation provenant d’une version antérieure de la liste est refusée avec une explication. Les états SENDING restent exclus de la suppression et les envois se limitent aux WAITING/ERROR autorisés. Les réservations atomiques et contrôles d’autorisation serveur existants restent appliqués.

L’aperçu et les détails d’erreur sont chargés sur demande. Une nouvelle recherche ou campagne annule immédiatement leur chargement, avant l’arrivée des nouvelles métadonnées. Le chargement et l’échec de la campagne sont distincts de ceux des messages.

Les fenêtres sont plafonnées à l’écran. L’aperçu possède une région de contenu nommée et focalisable pour défiler au clavier. READ est affiché « Signal d’ouverture » et ne constitue pas une preuve de lecture humaine.

## Vérification

Tests sur PostgreSQL jetable : pages stables, filtres combinés, limites, suppressions, confidentialité du résumé, objets fidèles à l’aperçu, corps non rendu lors du chargement de liste et droits des routes.

Tests Angular : sélection effacée avant réponse, anciennes lignes inertes, requêtes annulées, confirmation figée, aperçu et erreur à la demande, erreurs relançables et changement de campagne pendant un aperçu en attente. Le rendu réel sur mobile et le focus des dialogues restent à valider par l’utilisateur.
