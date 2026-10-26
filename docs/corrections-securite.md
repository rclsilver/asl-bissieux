# Suivi de la revue de sécurité — 26 octobre 2026

Les arbitrages sont terminés. Les changements ci-dessous sont commités
localement sur `dev`, par intention, sans push, release ni modification du
cluster. La chart est strictement inchangée. Aucune migration n'est ajoutée.

## Corrections livrées

| Sujet | Résultat | Commit |
| --- | --- | --- |
| Pixel public | Validation UUID puis mise à jour conditionnelle `SENT → READ`, sans SELECT, pièce jointe ni rendu. PNG transparent 1×1 identique pour tout identifiant ; réponse non mise en cache. | `7fbbe10` |
| Navigateur et CORS | Protection iframe, `nosniff`, politique de référent, CSP progressive ; retrait du CORS ouvert à toutes les origines. SPA, API et erreurs protégées. | `756e501` |
| CI | Action existante épinglée au SHA résolu ; construction limitée à `contents: read` / `packages: write`, publication isolée avec `contents: write`, aucun droit `id-token`. Déclencheurs conservés. | `9902dea` |
| Docker | Exclusion des configurations privées, clés, sauvegardes et SQL génériques. Migrations SQL et scripts de développement conservés. | `59637de` |
| Chargement des pièces jointes | Les listes, aperçus et suppressions n'en chargent plus le contenu. Le téléchargement et la livraison le conservent. | `ab4b4ff` |
| Jeton Kubernetes | Patch Terraform préparé et vérifié sur le dépôt réel, sans modifier ses fichiers ni appliquer au cluster. | `75e41e3` |
| Plafonds des pièces jointes | 10 Mio par fichier, 20 Mio par modèle, limites configurables. Contrôle multipart avant parsing, lecture bornée, fermeture des fichiers et suppression des temporaires. Total sérialisé par verrou du modèle pour résister aux ajouts simultanés. | `60f9ff8` |

Le contrôle avant livraison calcule les tailles réelles dans PostgreSQL,
sans rapatrier les contenus. Un ancien modèle dépassant les plafonds est
refusé avant chargement des pièces jointes et contact SMTP ; le message passe
à `ERROR` avec le motif. Les anciens fichiers restent téléchargeables et
supprimables pour permettre leur remplacement. Aucun fichier existant n'est
supprimé automatiquement. L'encodage MIME reste en mémoire, avec des tailles
de pièces jointes désormais bornées : ce n'est pas une refonte en streaming.

## Configuration

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `APP_ATTACHMENTS_MAX_FILE_BYTES` | `10485760` | 10 Mio par fichier, choisi par Thomas. |
| `APP_ATTACHMENTS_MAX_TEMPLATE_BYTES` | `20971520` | 20 Mio cumulés par modèle, choisi par Thomas. |
| `APP_HTTP_PUBLIC_HTTPS` | `false` | À mettre à `true` derrière l'Ingress HTTPS pour émettre HSTS. |
| `APP_HTTP_CSP_REPORT_ONLY` | `true` | Observation de la CSP détaillée ; passer à `false` seulement après recette navigateur. |

Les mêmes clés existent sous `attachments` et `http` dans la configuration
Viper. Les limites doivent être strictement positives et le total supérieur
ou égal à la limite par fichier. Le corps multipart complet est limité à la
taille maximale par fichier plus 1 Mio pour les champs et l'enveloppe ; les
dépassements de taille renvoient HTTP 413, y compris sans `Content-Length`.

La CSP minimale bloque déjà les iframes, les objets et le détournement de la
base des liens. La CSP détaillée autorise les ressources Angular et Google
identifiées dans le code, mais reste en observation avant recette réelle.
Les styles intégrés restent permis pour Angular Material. Aucun collecteur
de rapports n'est déployé ; consulter la console du navigateur. L'authentification
OIDC et la protection CSRF restent indépendantes du CORS.

HSTS est activé pour une connexion TLS directe ou par la configuration
explicite `public_https` ; un en-tête `X-Forwarded-Proto` fourni par un client
ne suffit pas. Ni `includeSubDomains` ni `preload` ne sont ajoutés. La durée
est d'un an : vérifier le HTTPS public avant activation dans le déploiement.

## Infrastructure : préparation uniquement

Le déploiement réel est géré par Terraform, pas par la chart. Le patch
[désactiver le jeton Kubernetes](desactiver-jeton-kubernetes.patch) ajoute
`automount_service_account_token = false` dans la spécification du pod.
`git apply --check` réussit sur le dépôt d'infrastructure actuel. Ses
changements préexistants sont préservés ; aucun fichier de ce dépôt n'a été
modifié. L'injection des Secrets SMTP/PostgreSQL ne dépend pas de ce montage.

Avant une application autorisée : appliquer le patch dans le dépôt infra,
vérifier son plan et ses différences, puis contrôler le nouveau pod après
déploiement. Le jeton reste présent dans la production actuelle tant que ce
changement n'a pas été appliqué. Les droits RBAC effectifs n'ont pas été
évalués ; aucune permission administrateur n'est présumée. `tofu` est absent
de cette machine : aucun `fmt`, `validate`, `plan` ou `apply` n'a été exécuté.

## Choix et limites conservés

- **SEC-01 : risque accepté provisoirement**, modèles réservés à Thomas ou
  à des auteurs de confiance. Les fonctions Sprig d'accès à l'environnement
  restent disponibles. Revoir ce choix si les auteurs changent.
- **SEC-04 : risque accepté**, PostgreSQL sans TLS dans le même cluster.
  Ce choix ne constitue pas une preuve de chiffrement du réseau interne.
- **SEC-06 : hors périmètre**, chart laissée en l'état. En production,
  SMTP utilise déjà des références à un Secret ; aucun identifiant réel
  n'a été affiché ni mémorisé.
- **SEC-03 : correction ciblée**, stockage bytea conservé. Les limites
  globales de corps JSON, de rendu des modèles, les délais du serveur HTTP
  et le débit des endpoints publics n'ont pas été ajoutés dans ce lot.
  Ils restent des points de suivi ; les protections du proxy ne sont pas
  supposées les couvrir sans vérification.
- Le pixel est devenu léger, mais ce changement ne prouve pas une résistance
  à une attaque de saturation. Aucun test de charge n'a été effectué.
- Le SHA CI fixe le code de l'action ; son ancien runtime déclaré `node12`
  n'est pas modernisé. La compatibilité avec le runner GitHub actuel reste
  à confirmer lors d'une CI autorisée. Aucune nouvelle automatisation
  d'archives Helm ou de publication n'est ajoutée.

## Vérifications

- Suite `go test -count=1 ./...` réussie avec PostgreSQL et Smocker jetables,
  puis `go vet ./...` et `go mod verify` réussis.
- Tests HTTP : aucun SELECT pour le pixel, tous états, identifiants inconnus
  et invalides, répétitions sans nouvel effet, PNG transparent valide.
- Tests PJ : taille par fichier, total exact, suppression libérant le quota,
  ajouts concurrents, ancien fichier dont la taille déclarée est incorrecte,
  aucun contact SMTP lors du refus et absence de chargement de son contenu.
- Tests upload réels : contrôle des droits, erreurs 413, flux sans taille
  déclarée coupé à la borne, multipart invalide en 400, aucun fichier temporaire
  résiduel ni pièce jointe refusée enregistrée.
- Tests HTTP : en-têtes SPA/API/erreurs, CORS absent, HSTS selon configuration
  sans confiance en un en-tête client, modes CSP et paramètres Viper.
- Workflow YAML et permissions vérifiés avec le parseur déjà installé ;
  contexte Docker synthétique testé par un vrai `COPY`, sans secret réel.
- La chart n'a aucun changement. Helm étant absent, ses tests nécessitant
  l'exécutable restent ignorés, comme avant ; aucune validation Helm nouvelle.
- Les services ASL étaient arrêtés et n'ont pas été démarrés. Les tests
  n'utilisent pas leur base, leurs sessions ni les services Google/OVH/SMTP
  réels. Pas de nouvelle recette visuelle ni de connexion Google réelle.

L'image finale `local/asl-bissieux:security-fixes` est construite et sa commande
`--version` vérifiée : `0.0.0-security-review`, commit applicatif `60f9ff8`,
utilisateur `10001:10001`. Son identifiant est
`sha256:2e7ca04ff5ef96ca064ca26996a751bed94a0cb844f18649595b794ce62abea0`.
Un premier essai a rencontré un échec DNS du réseau Docker lors de l'accès
aux index Alpine. La construction a ensuite réussi avec le réseau hôte et
la résolution Node IPv4 prioritaire, sans changer le Dockerfile ni les bases.
Cela inclut une compilation Angular de production, sans nouvelle recette
visuelle. Aucun conteneur applicatif n'a été démarré à partir de cette image.

La [fiche de validation](validation-securite.html) sépare les contrôles
automatiques de la recette humaine et des vérifications après un déploiement
autorisé. Ce lot n'est pas une autorisation de publier ou de déployer.
