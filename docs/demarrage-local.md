# Démarrage local reproductible

Prérequis : Git, Docker et Docker Compose v2. Les runtimes Go et Node sont fournis par les images, pas nécessaires sur l’hôte. Les versions, digests et lockfiles sont dans le dépôt. Travailler sur `dev` : `git switch dev`, ou `git switch -c dev` si cette branche locale n’existe pas encore. Aucun push n’est nécessaire pour un essai local.

## Nouveau clone avec base vide

Depuis la racine du dépôt, sans override privé :

```sh
docker compose -f docker-compose.yml config --quiet
docker compose up -d --build
docker compose ps
docker compose exec -T postgresql psql -U devel -d devel -v ON_ERROR_STOP=1 < dev/seed-oidc-validation.sql
```

La première commande vérifie la définition publique ; les suivantes prennent aussi en compte un éventuel `docker-compose.override.yml`. Ne pas rejouer les seeds sur une base réelle pour préparer un essai. Pour une ancienne base non versionnée, suivre d’abord la sauvegarde et l’adoption décrites dans README. Ne jamais supprimer le volume de données pour résoudre un échec de migration.

| Service | Accès standard | Particularité du poste actuel |
| --- | --- | --- |
| Frontend | http://localhost:4200 | Même port |
| API / santé | http://localhost:8080/api/mon/ping | Même port |
| Schéma OpenAPI | http://localhost:8080/api/spec.json | Même port |
| Keycloak développement | http://localhost:9080 | Conservé, Google choisi dans l’override privé |
| Swagger | http://localhost:8081 | Service facultatif, non démarré pour la revue actuelle |
| PostgreSQL | `postgresql:5432` dans Compose, sans port hôte | Réseau hôte, boucle locale `127.0.0.1:55432` |
| SMTP simulé | `smtp-mock:2023`, consultation interne `:2024` | Réseau hôte, ports 2023/2024 |

La configuration par défaut utilise le bridge Docker et Keycloak. Les comptes fictifs et mots de passe publics de développement sont dans README ; les droits applicatifs sont attribués par le seed, indépendamment des rôles du fournisseur. Les comptes existants ne sont jamais associés automatiquement par e-mail.

Le poste actuel utilise un override ignoré pour le réseau hôte. Il pointe le proxy Angular vers `127.0.0.1:8080` et garde les données existantes. Sa connexion Google réelle a déjà été validée ; ne pas remplacer cet override pour essayer Keycloak. Son secret est privé et monté en lecture seule. Le fichier JSON Google de développement est conservé hors dépôt ; il n’est pas nécessaire pour le démarrage Keycloak d’un nouveau clone.

## Modifier et redémarrer

Angular recharge les sources montées. Le backend `go run` ne recharge pas automatiquement les changements Go :

```sh
docker compose restart server frontend
docker compose ps
curl --fail http://localhost:8080/api/mon/ping
curl --fail --output /dev/null http://localhost:4200/
```

Si Go et Angular partagent le répertoire monté, attendre la fin d’un build Angular avant de compiler/tester Go, car les assets sont embarqués. Après un build, conserver le `.gitignore` suivi sous `frontend/dist/asl-bissieux/`.

Les dépendances restent dans des volumes nommés. Après changement du lockfile : reconstruire l’image frontend, exécuter `docker compose run --rm --no-deps frontend npm ci`, puis recréer ce service si nécessaire. Les ports occupés doivent être corrigés dans un override local, sans changer le fichier partagé ni supprimer de volume.

## Données et e-mails

`postgresql-data` conserve les données métier et `keycloak-data` le realm local. `docker compose down` conserve ces volumes ; l’option `-v` les supprime et ne doit pas être utilisée pour cette revue. La base actuelle contient les migrations 0001 à 0007 ; le tableau de bord n’ajoute aucune migration.

Le SMTP simulé ne transmet aucun message à l’extérieur. Ses messages sont en mémoire et disparaissent à son redémarrage. La préparation crée des messages dans PostgreSQL ; **Envoyer** contacte le SMTP. Les statuts enregistrés ne prouvent pas une lecture humaine. Tester uniquement avec des données fictives et vérifier le fournisseur SMTP avant toute action d’envoi.

## Contrat et vérifications

Le serveur doit être à jour et le frontend démarré avant :

```sh
./generate-openapi.sh
docker compose exec -T frontend npm run test:unit
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
docker compose run --rm --no-deps --entrypoint go server test ./...
```

`generate-openapi.sh` lit le schéma HTTP et remplace les types générés. Les fichiers Go et OpenAPI doivent être commités ensemble lorsque le contrat change. L’API métier exige une session ; `/api/spec.json` est le schéma public.

Les tests PostgreSQL nécessitent `TEST_DATABASE_URL` et un compte pouvant créer des bases. Ils créent/suppriment leurs bases `asl_test_*`. Utiliser une instance jetable dédiée ; sans cette variable, ces tests sont explicitement ignorés. Le journal financier et les accès ont aussi été vérifiés après restauration d’une sauvegarde dans une instance jetable, sans réinitialiser la base principale. Aucun SMTP réel n’est utilisé par les tests.

Voir également `tableau-de-bord.md`, `journal-financier.md`, `administration-acces.md` et `production-oidc.md`. Ce dernier sépare la connexion Google locale validée des prérequis encore nécessaires pour une production.

Le lockfile surcharge temporairement Vite en **8.3.3**, car le builder Angular
22.2.3 fixe encore 8.3.0. Cette correction traite les alertes du lanceur d’éditeur
sans rétrograder Angular. Conserver la surcharge jusqu’à une version du builder
qui intègre le correctif ; toute suppression doit repasser audit, tests et build.
