# Pagination de la liste des campagnes

La liste des campagnes utilise des résumés paginés. L’historique des messages utilise également une pagination, décrite dans [pagination-emails.md](pagination-emails.md).

## Contrat HTTP

`GET /api/email/campaigns` renvoie désormais un objet `{ items, total, page, page_size }`, à la place de l’ancien tableau complet. Le client Angular et ses types OpenAPI sont mis à jour ensemble.

- `page` : commence à 1, défaut 1, maximum 1 000 000. Une page devenue inexistante est ramenée à la dernière page disponible.
- `page_size` : défaut 25, maximum 100. Une valeur zéro utilise le défaut, comme pour page.
- `query` : recherche littérale dans le titre, insensible à la casse, espaces périphériques retirés, maximum 200 caractères Unicode. Les caractères % et _ sont recherchés littéralement.
- `sort` : `created_at` (défaut) ou `title`.
- `direction` : `desc` (défaut) ou `asc`.
- Les options invalides renvoient HTTP 400. Les droits de consultation existants restent appliqués : utilisateur authentifié et actif.

Chaque résumé contient seulement identifiant, titre, date de création et compteurs. Ni contexte de personnalisation, ni modèle, ni destinataire individuel, corps de message ou pièce jointe ne sont chargés par cette liste.

Les compteurs regroupent attente, envoi en cours, succès, erreur et résultat à vérifier. **successful inclut SENT et READ une seule fois**. Un signal de pixel ne constitue pas une preuve de lecture humaine. Les messages supprimés ne sont pas comptés.

Le total, les lignes et leurs agrégats utilisent une transaction de lecture cohérente. Les agrégats sont limités aux identifiants des campagnes de la page ; le second critère de tri est toujours l’UUID, pour départager les dates ou titres identiques.

## Interface

Seule EmailCampaignDataSource utilise la nouvelle PagedDataSource. Les autres tableaux gardent recherche et tri locaux. Pour une source paginée, le tableau transmet recherche et tri au serveur et ne traite pas une seconde fois la seule page reçue. HttpParams étant immuable, ApiService conserve désormais la valeur renvoyée par set.

Recherche, tri et changement de taille reviennent à la première page. Une nouvelle demande annule la précédente ; une réponse ancienne ne remplace pas une recherche récente. Après suppression, le serveur ajuste une page devenue vide. Les critères sont conservés en cas d’erreur et de relance.

La pagination française se situe hors du défilement horizontal. Son groupe interne peut se replier ; sur conteneur étroit, la plage de résultats dispose d’une ligne. Le statut natif de Material est conservé sans annonce supplémentaire.

## Vérification

Les tests PostgreSQL utilisent une base jetable indépendante, avec 123 campagnes et 1 000 messages fictifs, suppressions comprises. Ils vérifient bornage, tri stable sans doublon, filtres littéraux, agrégats et absence de contenus privés dans les réponses. Les tests HTTP couvrent les droits et options invalides. Les tests Angular couvrent navigation, requêtes réelles avec paramètres, recherche et tri globaux, annulation, changement de taille, correction de page après suppression et relance après erreur.

La navigation et la mise en page réelles sur mobile doivent être validées par l’utilisateur ; aucun navigateur n’est utilisé par l’agent.
