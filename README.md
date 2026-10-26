# ASL Bissieux

Application Go / Angular / PostgreSQL. Effectuer les modifications sur `dev`.

Préparation du candidat, versions des images et du chart, notes et prérequis
de production : [publication et release](docs/publication-release.md).

La [revue de sécurité avant publication](docs/revue-securite.md) recense les
constats du candidat et les conditions de correction avant release.

## Développement local

Docker Compose v2 est requis. Depuis la racine du dépôt :

Pour une base existante issue d’une version antérieure au lot 3, suivre
d’abord la procédure d’adoption ci-dessous. Une base neuve est initialisée
par la première migration lors du démarrage.

```sh
docker compose up -d --build
docker compose ps
```

- Application : http://localhost:4200
- API et OpenAPI : http://localhost:8080/api/spec.json
- Swagger : http://localhost:8081
- Fournisseur OIDC local : http://localhost:9080

Les ports de l’application et de l’API sont réservés à la boucle locale.
PostgreSQL conserve les données dans un volume nommé ; `docker compose down`
les préserve. Le SMTP simulé reçoit les e-mails sans les transmettre.
L’installation frontend utilise le lockfile (`npm ci`) à la construction.
Après modification des dépendances, reconstruire l’image et mettre à jour le
volume de dépendances avec `docker compose run --rm --no-deps frontend npm ci`.

Compose utilise Keycloak pour la connexion locale. Après migration, lancer
`dev/seed-oidc-validation.sql` pour préparer les trois comptes fictifs décrits
ci-dessous, sans modifier les comptes Google existants. Une installation
hors Compose conserve le fournisseur Google historique par défaut jusqu’à
sa bascule explicite vers OIDC.

Un éventuel `docker-compose.override.yml` est ignoré par Git : il peut adapter
le réseau à la machine. Sur ce PC, le réseau bridge Docker ne permet pas
les communications attendues ; l’override utilise le réseau hôte, PostgreSQL
écoute sur `127.0.0.1:55432`, et le proxy Angular vise `127.0.0.1:8080`.

## Tests

Après construction du frontend (nécessaire à l’embarquement Go) :

```sh
docker compose run --rm --no-deps frontend sh -c 'npm run test:unit && npm test && npm run build'
docker compose run --rm --no-deps --entrypoint go server test ./...
docker compose run --rm --no-deps --entrypoint sh server -c 'TEST_DATABASE_URL=postgres://devel:devel@postgresql:5432/devel?sslmode=disable go test -timeout 90s -count=1 ./...'
```

Sur ce PC avec l’override réseau hôte, remplacer `postgresql:5432` par
`127.0.0.1:55432` dans `TEST_DATABASE_URL`.
Les tests d’intégration créent une base temporaire `asl_test_*`, puis la
suppriment. Le compte doit pouvoir créer des bases. Ils ne migrent jamais
la base fournie dans l’URL et sont explicitement ignorés si cette variable
n’est pas définie. Les tests SMTP utilisent un serveur simulé en boucle locale.

La CI `Validate` exécute les tests frontend, le build Angular de production,
les tests Go et les tests PostgreSQL. La publication d’une image dépend
du succès de ces vérifications. Une pull request ne publie aucune image.

## Jeu de validation du premier lot

Uniquement sur une base locale vide, après migration au démarrage du serveur :

```sh
docker compose exec -T postgresql psql -v ON_ERROR_STOP=1 -U devel -d devel -v admin_email='votre-compte@example.com' < dev/seed-validation.sql
```

Sur ce PC, ajouter `-p 55432` aux arguments de `psql`.
Ce script autorise le compte fourni comme administrateur local et ajoute
un budget fictif de 500 €, cinq lots et leurs paiements. Il n’écrase pas
les paiements existants lors d’une nouvelle exécution.

| Lot | Dû | Réglé | État attendu |
| --- | ---: | ---: | --- |
| 1 | 100 € | 0 € | Rouge |
| 2 | 100 € | 25 € | Rouge |
| 3 | 100 € | 50 € | Orange |
| 4 | 100 € | 100 € | Vert |
| 5 | 100 € | 120 € | Violet : 20 € à rembourser |

La carte et le tableau utilisent la même règle : violet en cas de trop-perçu
à rembourser, vert si le montant dû est exactement réglé, orange à partir
de la moitié, rouge en dessous de la moitié. Le tableau met en évidence le
solde négatif en violet et en gras, avec une infobulle « Montant à rembourser »,
sans texte ajouté à côté du statut.

## Fiabilité des e-mails (lot 2)

Un e-mail est réservé atomiquement avant de contacter le SMTP. Deux demandes
concurrentes ne peuvent pas obtenir la même réservation. Les états, stockés
dans la colonne texte existante, sont :

| État technique | Affichage | Action |
| --- | --- | --- |
| WAITING | En attente | Envoi possible |
| SENDING | En cours | Envoi, remise en erreur et suppression bloqués |
| SENT / READ | Envoyé / Lu | Aucun renvoi direct |
| ERROR | Erreur | Nouvelle tentative possible |
| UNKNOWN | À vérifier | Vérifier la réception avant d’autoriser un renvoi |

Le succès est enregistré après la réponse finale du SMTP. Un refus explicite
reste une erreur ; une connexion perdue après transmission peut signifier
que le message a été reçu : le résultat devient « À vérifier ». Un échec
de sauvegarde après SMTP ne réautorise jamais silencieusement un envoi.
Les échanges SMTP ont un délai maximal de 30 secondes par défaut,
configurable avec `smtp.timeout` / `APP_SMTP_TIMEOUT`.

Les envois asynchrones continuent après la fin de la requête HTTP. Ils ne
sont pas une file de travaux persistante : un arrêt du processus peut
laisser un message « En cours ». Aucune reprise automatique n’est effectuée,
car son résultat pourrait être incertain. Cette approche ne garantit pas
une livraison exactement une fois, notamment après une reprise manuelle.

Pour récupérer un message resté « En cours » après interruption :

1. Arrêter **toutes** les instances applicatives et les workers d’envoi.
2. Vérifier le résultat auprès du serveur SMTP.
3. Avec l’application arrêtée, exécuter `dev/recover-email.sql` dans la base
   concernée avec la variable psql `email_id` ; ce script remet uniquement
   ce message à « À vérifier » et ne contacte jamais le SMTP.
4. Redémarrer l’application. Autoriser un renvoi dans le menu du message
   seulement si la vérification confirme qu’il est nécessaire.

Les campagnes de budget regroupent les cotisations par identifiant stable
d’adhérent, y compris pour un adhérent multi-lots. Les copropriétaires
conservent leurs messages individuels. Les filtres distinguent les lots
en dessous de la moitié, en cours et soldés ou en trop-perçu.

Le script local `dev/seed-email-validation.sql`, à lancer après le jeu du
lot 1, ajoute un budget indépendant, trois adhérents fictifs, un modèle et
une campagne d’exemples d’états. Il conserve les essais existants. Les tests
automatisés couvrent également les envois concurrents, les erreurs SMTP,
les pertes d’accusé de réception et les pannes de persistance.

## Migrations de base de données (lot 3)

Les fichiers SQL numérotés de `pkg/db/migrations/` sont embarqués dans le
binaire. Leur version, nom, empreinte SHA-256 et date d’application sont
enregistrés dans `public.schema_migrations`. Une transaction et un verrou
PostgreSQL sérialisent les migrations des différentes instances ; une erreur
annule les modifications de la tentative, y compris l’historique. Une version
appliquée et sa description de référence sont immuables : ajouter un nouveau
fichier pour chaque évolution.

```sh
docker compose run --rm --no-deps server database status
docker compose run --rm --no-deps server database baseline
docker compose run --rm --no-deps server database migrate
```

`status` est en lecture seule. `baseline` adopte une base existante uniquement
si ses tables, colonnes, contraintes, index et triggers correspondent au schéma
initial figé. Elle écrit l’historique sans modifier les lignes métier.
L’ordre physique des colonnes et les doublons de clés étrangères strictement
équivalentes n’affectent pas cette comparaison. Sous PostgreSQL 18, les
contraintes `NOT NULL` du catalogue sont vérifiées par la nullabilité des
colonnes. Les types, valeurs par défaut, cibles et actions des clés étrangères,
contraintes, index et triggers restent contrôlés ; les migrations SQL figées
et leurs empreintes ne sont pas modifiées.
`migrate` applique les versions en attente ; sur une base neuve, elle crée
aussi le schéma initial. Une base existante non versionnée, une empreinte
modifiée ou une version inconnue provoquent une erreur explicite.

Avec `db.migrate: true`, le démarrage applique les migrations en attente.
Avec false, il vérifie que la base est déjà à jour et n’exécute aucun DDL.
Les modifications des modèles Go ne déclenchent plus d’AutoMigrate.

### Sauvegarde, adoption et reprise

Avant l’adoption d’une installation existante ou une migration de données :

1. Arrêter les instances et workers susceptibles d’écrire dans cette base.
2. Sauvegarder avec `pg_dump --format=custom --no-owner --no-privileges`
   dans un emplacement privé adapté à l’installation.
3. Restaurer la sauvegarde dans une **nouvelle base de vérification** avec
   `createdb`, puis `pg_restore --exit-on-error --no-owner --no-privileges`.
4. Répéter `database baseline` si nécessaire, puis `database migrate`, en
   ciblant la copie avec `APP_DB_BASE`. Comparer les empreintes obtenues avec
   `psql -X -A -t ... < dev/data-fingerprint.sql`, les comptes, permissions,
   relations, montants et états. Le lot 3 préserve toutes les lignes.
5. Appliquer la même procédure sur la base ciblée après vérification de la
   copie, puis redémarrer les instances et vérifier les parcours applicatifs.

Si une migration échoue, sa transaction est annulée. Pour revenir à un état
antérieur après une évolution déjà appliquée, restaurer la sauvegarde dans une
nouvelle base, vérifier son contenu, puis basculer la configuration applicative
vers cette base avec la version compatible du binaire. Conserver la base
précédente pour analyse. Les modifications financières futures demanderont
également une vérification des totaux et des arrondis spécifiques.

Sur ce PC, les commandes PostgreSQL utilisent le port 55432 dans le conteneur.
La sauvegarde du lot 3 a été restaurée et vérifiée avant adoption de la base
locale. Aucune opération de production n’a été réalisée : une bascule de
production demande une autorisation distincte.

### Validation Google

Les appels de validation Google ont un délai maximal de cinq secondes,
respectent l’annulation de la requête et ferment le corps HTTP sur tous les
statuts. Les erreurs ne contiennent pas l’URL portant le jeton. Les jetons
expirés, destinés à un autre client ou sans compte vérifié sont refusés.
Les rôles et permissions applicatives restent conservés dans la base.

## Budgets publiés (lot 4)

Règle choisie par Thomas : les dépenses et les cotisations d’un budget publié
sont figées et le budget ne peut plus être supprimé, même par un administrateur.
Le libellé et les paiements restent modifiables selon les droits attribués.
Les rectifications financières futures passeront par des ajustements tracés.

Publication et modifications financières verrouillent la ligne du budget
dans une transaction, afin qu’une dépense ne puisse pas être modifiée pendant
son calcul. Une seconde publication est refusée sans créer de cotisations.
Le changement de libellé ne réécrit jamais un ancien état brouillon.

La migration 0002 impose l’unicité des cotisations actives par budget/lot.
Elle refuse les doublons existants pour permettre une analyse et une correction
revues, sans suppression automatique. Les anciennes cotisations supprimées
logiquement restent conservées avec leur historique et leurs paiements.
La suppression d’un brouillon supprime aussi logiquement ses dépenses ; un
brouillon comportant déjà des cotisations doit être examiné avant suppression.

Les tests HTTP couvrent administrateur, opérateur autorisé, lecteur, compte
inactif et accès non authentifié, ainsi que concurrence, rollback et maintien
des paiements. `dev/seed-publication-validation.sql` ajoute un brouillon
indépendant pour les essais locaux sans réinitialiser les validations précédentes.

## Montants précis et aperçu du budget (lot 5)

Les montants sont calculés en décimal et conservés en `numeric` PostgreSQL. Les
nouvelles dépenses et les nouveaux paiements sont strictement positifs, au centime
(plafond de saisie et de publication : 9 999 999 999,99 €). Les parts sont des
entiers positifs ou nuls. La migration `0003_financial_input_guards.sql` protège
les insertions et les changements de valeur ; elle ne recalcule aucune donnée
historique. Un ancien montant fractionnaire reste lisible, mais doit être corrigé
explicitement avant une nouvelle écriture financière. Un brouillon comportant
une ancienne dépense invalide ne peut pas être publié tant qu’elle n’est pas corrigée.

À la publication, les cotisations des lots ayant des parts positives sont d’abord
arrondies au centime inférieur. Les centimes restants sont attribués dans l’ordre
des plus grands restes ; les égalités suivent les numéros de lots croissants.
La somme est exactement égale au total des dépenses. Un lot à parts positives peut
recevoir une cotisation nulle pour un budget minuscule ; un lot sans part n’en reçoit
aucune. Exemple : 100 € pour trois lots d’une part donne 33,34 €, 33,33 €, 33,33 €.
Le jeu des lots et leurs parts est verrouillé pendant la publication pour empêcher
un changement concurrent de modifier la répartition.

Le détail d’un brouillon affiche le total du budget, le total des parts, le montant
annuel par part et le montant mensuel par part sur **12 mois**, arrondis à six
décimales à titre indicatif. Les cotisations finales ne sont jamais calculées à
partir de ces taux déjà arrondis. L’aperçu ne crée ni cotisation, ni paiement,
ni e-mail. Il se recharge après une modification des dépenses, au retour dans la
fenêtre, ou avec **Actualiser** après un changement des parts.

Pour préparer un brouillon fictif sans écraser des essais existants :

```sh
docker compose exec -T postgresql psql -U devel -d devel -v ON_ERROR_STOP=1 < dev/seed-money-validation.sql
```

Sur ce PC, ajouter `-p 55432` aux arguments de `psql`.

## Socle backend et images (lot 6)

Le backend nécessite Go **1.27.3**. Docker et la CI utilisent la même version ;
les images Go et Alpine **3.24.2** sont figées par version et digest. Les modules
Go sont verrouillés par `go.mod` et `go.sum`, vérifiés avec `go mod verify`.
`make asl-bissieux` reconstruit systématiquement un binaire statique, avec
`-mod=readonly`, `-trimpath` et sans métadonnées Git dépendantes du poste.
L’image finale installe les certificats HTTPS et les fuseaux horaires, et
s’exécute avec l’utilisateur non privilégié 10001. Les routes Angular directes
(par exemple `/budgets`) servent l’application lors d’un rechargement ; une
ressource absente et une route API inconnue conservent leur erreur 404.

Le SMTP de développement est construit depuis la révision OVH CDS
`842a22a27931a618da66430656d4ae606bdcdff1`. Ses dépendances corrigées sont
verrouillées dans `smtp-mock/go.mod` et `smtp-mock/go.sum` ; sa compilation
refuse de modifier ces fichiers. Il reste un serveur simulé, avec les ports
SMTP 2023 et consultation HTTP 2024. Les messages reçus sont en mémoire ;
ils disparaissent au redémarrage du SMTP, indépendamment des états conservés
dans la base de l’application.

Pour reconstruire les services de développement et les démarrer :

```sh
docker compose build server smtp-mock
docker compose up -d --no-build server frontend smtp-mock
```

Pour vérifier l’image finale, qui embarque le frontend :

```sh
docker build -t local/asl-bissieux-runtime .
```

Elle nécessite la configuration PostgreSQL, SMTP et Google par variables
`APP_*` ou fichier monté. L’identifiant Google est un identifiant client public ;
ne pas intégrer de secrets dans l’image. Le contexte Docker exclut Git et les
fichiers locaux de configuration `*.override.yaml`.

La CI exécute également `govulncheck` **v1.9.0** sur le code et les binaires des
images application et SMTP. L’audit est daté et dépend de la base Go des
vulnérabilités ; son succès ne constitue pas une garantie d’absence de défaut.
L’alerte GO-2026-5932 peut apparaître au niveau du module `x/crypto` : le package
OpenPGP concerné n’est ni importé ni compilé dans ces services.

## Socle frontend (lot 7)

Le frontend utilise Angular et Material **22.2.3**, TypeScript **6.0.3**,
Node **24.22.0 LTS** et npm **11.19.1**. L’image Node est figée par digest ;
`package-lock.json` verrouille les dépendances. Les migrations officielles
ont été appliquées majeure par majeure depuis Angular 16.

La compilation utilise le builder Angular actuel (esbuild) et le serveur de
développement Vite. Les fichiers restent directement dans `dist/asl-bissieux`
pour leur embarquement dans Go. Les modèles utilisent les blocs Angular
`@if` et `@for`. La détection de changements, les requêtes HTTP et la connexion
Google gardent leur comportement existant. La configuration OIDC/Keycloak est décrite
dans la section suivante.

Les tests Angular s’exécutent avec Vitest et jsdom, sans installation de Chrome.
Ils vérifient le formulaire de paiement, l’intercepteur d’authentification et
la carte, en complément des tests métier. La CI lance les deux suites et refuse
les vulnérabilités npm de sévérité haute ou critique.

```sh
docker compose build frontend
docker compose run --rm --no-deps frontend npm ci
docker compose up -d --no-build frontend
docker compose run --rm --no-deps frontend npm audit --audit-level=high
```

Sur ce PC, l’override ajoute les options Node
`--dns-result-order=ipv4first --no-network-family-autoselection` au service
frontend et à l’argument de build `NODE_NETWORK_OPTIONS`. Elles évitent les
délais réseau observés avec la sélection automatique IPv4/IPv6. Pour construire
l’image finale sur ce poste :

```sh
docker build --network host --build-arg 'NODE_NETWORK_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection' -t local/asl-bissieux-runtime .
```

Les polices Google restent chargées par le navigateur ; leur téléchargement
n’est plus nécessaire pendant la compilation de production.

## Connexion OIDC et Keycloak local (lot 8)

Keycloak **26.8.1**, figé par digest, est lancé par Compose avec le realm
`asl-dev`. Sa base embarquée de développement est conservée dans le volume
`keycloak-data`, distinct du volume PostgreSQL de l’application. Le fichier
`dev/keycloak-realm.json` est importé au premier démarrage ; un realm déjà
existant et ses modifications ne sont pas écrasés.

Après application de la migration `0004` :

```sh
docker compose exec -T postgresql psql -U devel -d devel -v ON_ERROR_STOP=1 < dev/seed-oidc-validation.sql
```

Sur ce PC, ajouter `-p 55432` aux arguments de `psql`.

| Compte fictif | Mot de passe local | Droits applicatifs initiaux |
| --- | --- | --- |
| `admin@example.invalid` | `asl-admin-dev` | Administrateur actif |
| `reader@example.invalid` | `asl-reader-dev` | Lecture, sans administration ni modification |
| `pending@example.invalid` | `asl-pending-dev` | Compte en attente d’activation |

La console Keycloak locale utilise `local-admin` / `asl-keycloak-dev`.
Ces identifiants sont des fixtures publiques de développement, à garder
uniquement dans cet environnement local. La connexion applicative utilise
**Se connecter**, avec retour à la page demandée. La déconnexion révoque la
session applicative et passe par la confirmation de déconnexion Keycloak.

### Protocole et sessions

Go récupère la découverte OIDC, lance Authorization Code avec PKCE S256,
`state` et `nonce`, puis échange le code côté serveur. Il vérifie la signature
avec les clés JWKS et contrôle issuer, audience, expiration, nonce et `azp`
si nécessaire. Les tentatives sont liées au navigateur, expirent après dix
minutes et sont consommées atomiquement une seule fois, même avec plusieurs
instances. Codes, tokens et paramètres de retour OIDC ne sont pas journalisés.

Le navigateur reçoit ensuite un identifiant de session aléatoire en cookie
HttpOnly, SameSite=Lax, Secure en HTTPS. Seuls les hashes des identifiants de
session et des jetons CSRF sont conservés dans PostgreSQL. Les écritures
requièrent aussi le jeton `X-XSRF-TOKEN` et l’origine publique configurée.
Les tokens OIDC et refresh tokens ne sont pas conservés ni envoyés à Angular.

Une session applicative dure huit heures par défaut, sans prolongation
silencieuse (`auth_oidc.session_duration`, maximum 24 h). Après expiration,
une nouvelle connexion OIDC utilise la session SSO du fournisseur si elle est
encore valide. Les droits et l’activation sont relus dans la base à chaque
requête ; les rôles externes ne donnent aucun droit applicatif.

L’issuer canonique local est `http://localhost:9080/realms/asl-dev` pour le
navigateur et les jetons. Le backend en réseau bridge atteint les mêmes
endpoints via `auth_oidc.backchannel_url: http://keycloak:9080`. Seule l’origine
des requêtes serveur est réécrite ; le contrôle de l’issuer reste actif.
L’override de ce poste utilise `http://127.0.0.1:9080` comme backchannel.
HTTP est accepté seulement avec `auth_oidc.allow_insecure_http: true`, défini
par Compose pour cet environnement de développement.

### Comptes existants et bascule Google

La migration ajoute des identités `(issuer, subject)` et des tables de session,
sans recalculer ni renuméroter les comptes, droits, paiements ou autres données.
Une identité déjà associée retrouve son compte même si l’e-mail du fournisseur
change. Un nouvel utilisateur OIDC est créé sans activation ni droits ; une
collision avec un compte existant demande une association explicite et ne
transfère jamais ses droits sur la seule base d’un e-mail.

Pour préparer une transition Google, déployer d’abord cette version avec
`auth.provider: google`. Une connexion Google vérifiée enregistre alors le
`sub` stable du compte déjà authentifié. Une identité Google déjà connue
prime sur l’e-mail ; une réattribution de cet e-mail à un autre `sub` est
refusée. Cette phase permet de garder les comptes et leurs permissions lors
du passage ultérieur à OIDC. Pour un compte qui n’a pas effectué cette étape,
un opérateur peut associer un `issuer` et un `sub` **vérifiés** à son UUID :

```sh
docker compose run --rm --no-deps server identity link --issuer 'https://accounts.google.com' --subject 'SUJET_VERIFIE' --user-id 'UUID_DU_COMPTE_EXISTANT'
```

La commande ne change ni l’activation ni les droits et refuse de déplacer
une identité appartenant déjà à un autre compte.

Google OIDC pour une application web nécessite un secret conservé côté
serveur et une URI de retour exactement autorisée dans Google Cloud. Exemple
de configuration, avec un secret monté depuis un emplacement privé :

```yaml
auth:
  provider: oidc
auth_oidc:
  issuer: https://accounts.google.com
  client_id: VOTRE_IDENTIFIANT_CLIENT_PUBLIC
  client_secret_file: /run/secrets/asl-oidc/client-secret
  public_url: https://votre-application.example
  label: Google
  session_duration: 8h
```

L’URI à autoriser est `https://votre-application.example/api/auth/callback`.
Ne jamais mettre le secret dans Angular, Git ou l’image. Le chart accepte
`auth.provider`, `auth.oidc.*` et `auth.oidc.existingSecret` pour monter un
Secret Kubernetes existant. La valeur historique `auth.client_secret` du
chart ne configure pas OIDC ; utiliser la référence de Secret.

La déconnexion Google ferme la session de l’application ; elle ne déconnecte
pas globalement le compte Google dans le navigateur. Le parcours Google réel,
la configuration Cloud et les associations de comptes doivent être vérifiés
avant une bascule de production séparément autorisée. Le lot 8 ne déploie
rien en production et ne modifie aucun client Google distant.

## Parcours livrés et documentation

- [Fiche de validation à cocher — lots 1–18 et OVH](docs/fiche-validation.md), également disponible en [HTML interactif autonome](docs/fiche-validation.html).
- [Validation de la refonte Bassin clair / Graphite](docs/validation-refonte.md), avec [16 tests à cocher](docs/validation-refonte.html) indépendants de la fiche précédente.
- [Système visuel, thèmes et composants](DESIGN.md)
- [Démarrage local, ports et vérifications](docs/demarrage-local.md)
- [Accueil : recouvrement, carte, encaissements et synthèses](docs/tableau-de-bord.md)
- [Remboursements, ajustements et contre-écritures](docs/journal-financier.md)
- [Approbation des comptes et permissions](docs/administration-acces.md)
- [Préparation de la bascule Google OIDC en production](docs/production-oidc.md)
- [Pagination des campagnes](docs/pagination-campagnes.md) et [des e-mails](docs/pagination-emails.md)
- [Variables des modèles](docs/variables-email.md) et [terminologie](docs/terminologie-interface.md)

Sur le poste de validation actuel, Google OIDC est actif dans l’override privé ;
la description Keycloak ci-dessus reste celle du Compose public pour un nouveau clone.

## Listes de diffusion OVH

L’écran administrateur **Listes de diffusion** compare et synchronise les abonnés
Membres et Bureau avec l’annuaire. La case **Membre du bureau** est indépendante
des droits applicatifs. Le client utilise `OVH_ENDPOINT`, `OVH_APPLICATION_KEY`,
`OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY` ; les cibles sont définies par
`APP_ML_DOMAIN`, `APP_ML_MEMBERS`, `APP_ML_BUREAU`.
Ces trois cibles passent par Viper, section YAML `ml` et options `--ml-*`.
Voir [configuration et vérification](docs/listes-diffusion-ovh.md).
En développement, Compose configure automatiquement **Smocker** avec des
identifiants fictifs ; les ajouts/retraits et les tâches asynchrones sont simulés.
En production, définir les quatre variables `OVH_*` du client officiel et les
trois cibles `APP_ML_*` ci-dessus. Le chart n’installe aucun simulateur.
La migration 0007 initialise cette appartenance à faux. Sans configuration, aucune liste
réelle n’est lue ou modifiée et l’écran indique que la connexion reste à configurer.
