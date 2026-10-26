# Revue de sécurité avant publication

**Date : 25 octobre 2026. Candidat examiné : `9406842` sur `dev`.**

**Suivi du 26 octobre :** les arbitrages de Thomas et les corrections locales
sont décrits dans [le suivi des corrections](corrections-securite.md).
Les constats et l'avis ci-dessous sont ceux de l'audit initial : SEC-01 et
SEC-04 font désormais l'objet d'une acceptation de risque explicite, et le
chart est laissé inchangé. Ne pas confondre ce document historique avec le
statut du candidat corrigé ni avec une validation de production.

**Avis : publication déconseillée en l'état.** Une faille élevée de lecture
des variables d'environnement est confirmée. Cinq constats de niveau moyen
complètent la revue. Aucun correctif applicatif n'a été appliqué pendant cet
audit ; ce document décrit le candidat avant correction.

## Constats prioritaires

| Identifiant | Niveau | Constat | Validation |
| --- | --- | --- | --- |
| SEC-01 | Élevé — bloquant | Les modèles d'e-mail peuvent lire l'environnement du serveur. | Reproduit par HTTP avec un compte non administrateur et un marqueur fictif. |
| SEC-02 | Moyen | Le pixel de suivi public charge les pièces jointes et peut exécuter le modèle. | Reproduit sans session, sur des e-mails fictifs. |
| SEC-03 | Moyen | Limites insuffisantes sur les téléversements, le rendu et les requêtes HTTP. | Code examiné ; aucune attaque de saturation effectuée. |
| SEC-04 | Moyen, selon le réseau de production | PostgreSQL utilise obligatoirement `sslmode=disable`. | Configuration du client confirmée dans le code. |
| SEC-05 | Moyen — à traiter avant publication | Une action de release non épinglée reçoit des permissions d'écriture. | Workflow confirmé ; aucune action distante exécutée. |
| SEC-06 | Moyen, si SMTP authentifié | Le chart place le mot de passe SMTP directement dans le Deployment. | Template confirmé ; aucune valeur réelle consultée. |

### SEC-01 — Lecture de l'environnement par les modèles d'e-mail

`pkg/templates/templates.go:35` enregistre l'intégralité de
`sprig.TxtFuncMap()`, notamment `env`, `expandenv` et `getHostByName`.
Les modèles fournis par les utilisateurs sont exécutés par
`controllers/emails.go:101` et `controllers/emails.go:387`.

Un compte actif disposant uniquement de `email.CreateEmailTemplate` peut
créer un modèle dont le sujet est `{{ env "SECURITY_REVIEW_CANARY" }}`,
puis appeler son aperçu. Le test HTTP isolé confirme que l'aperçu lui
renvoie le marqueur fictif placé dans l'environnement du processus.
L'utilisateur testé n'est pas administrateur et ne dispose d'aucun droit
d'envoi. La création par un simple lecteur est bien refusée avec HTTP 403.

**Impact :** divulgation possible des secrets présents dans l'environnement,
notamment les identifiants OVH, PostgreSQL et SMTP lorsqu'ils y sont injectés.
Le fait de les fournir par `secretKeyRef` ne protège pas de cette lecture à
l'intérieur du processus. La lecture de fichiers arbitraires ou une exécution
de commandes n'ont pas été démontrées ; le secret OIDC monté en fichier
n'est donc pas déclaré compromis par cette preuve.

**Correction :** remplacer la liste complète par une liste explicite de
fonctions de mise en forme autorisées, sans accès à l'environnement ni au
réseau. Utiliser la même liste pour l'analyse des champs
(`pkg/templates/fields.go:94`) et le rendu. Examiner aussi les fonctions
d'allocation et de calcul coûteuses, et traiter les limites de SEC-03.

**Critère de fermeture :** rejet de `env`, `expandenv` et des fonctions réseau
à la validation et au rendu, tests négatifs par HTTP, conservation du rendu
des modèles légitimes. Si cette version a déjà servi avec des auteurs de
modèles non fiables, examiner les modèles et les traces puis décider d'une
rotation ciblée des secrets accessibles ; aucune exposition réelle n'a été
établie par cet audit.

### SEC-02 — Traitement excessif sur le pixel de suivi public

La route publique est déclarée dans `server/server.go:435`.
`server/handlers/emails.go:481` appelle `GetEmail`, qui précharge toutes les
pièces jointes (`controllers/emails.go:250`) et rend le modèle pour les
messages `WAITING` ou `ERROR` (`controllers/emails.go:257`).

Deux preuves isolées réussissent : un appel sans session à un e-mail fictif
en attente déclenche un marqueur d'erreur de rendu ; un appel sur un e-mail
fictif envoyé exécute une requête de chargement des pièces jointes.
Le pixel ne renvoie pas leur contenu à l'appelant.

**Impact :** une personne connaissant un identifiant d'e-mail, notamment
un destinataire ayant reçu son lien de suivi, peut répéter des requêtes
publiques coûteuses en base et en mémoire. Le rendu dépendant de l'état
élargit encore cette surface. Aucun test de charge n'a quantifié une panne.

**Correction :** effectuer uniquement une mise à jour atomique de l'état
`SENT` vers `READ` après validation de l'identifiant, sans préchargement ni
rendu ; conserver une réponse uniforme pour les identifiants inconnus.
Ajouter une limitation de débit adaptée au point d'entrée public.

**Critère de fermeture :** tests vérifiant l'absence de requête sur les
pièces jointes et d'exécution de modèle, quel que soit l'état du message.

### SEC-03 — Bornes de ressources insuffisantes

`server/handlers/emails.go:169` accepte le multipart puis copie entièrement
le fichier en mémoire à la ligne 214, sans plafond applicatif explicite.
Le seuil mémoire multipart de Gin n'est pas une limite de taille de requête :
il peut simplement déporter les données sur disque avant cette copie.

`pkg/templates/templates.go:41` utilise un tampon de sortie sans borne et
les fonctions Sprig peuvent allouer ou calculer avant d'y écrire. Une preuve
volontairement bornée produit 4 096 octets à partir d'un modèle de 21 octets.
Elle illustre l'amplification et ne constitue pas une attaque de saturation.

Enfin, `server/server.go:507` utilise `http.ListenAndServe` sans délais
explicites, et `/api/auth/login` crée une tentative en base à chaque appel
(`pkg/auth/oidc_login.go:61`), sans limite de débit applicative identifiée.
Les protections éventuelles du reverse proxy de production restent inconnues.

**Correction :** plafonner les corps JSON et multipart, la taille et le
nombre des pièces jointes, les modèles et leurs sorties ; fermer les fichiers
ouverts ; restreindre ou borner les fonctions coûteuses avant allocation.
Configurer les délais du serveur et la limitation de débit, avec des valeurs
compatibles avec les usages et les protections de l'Ingress.

**Critère de fermeture :** requête trop grande refusée avec HTTP 413 avant
chargement complet, sortie excessive interrompue, cas limites couverts par
des tests bornés ; délais et limitation vérifiés sur la chaîne HTTP réelle.

### SEC-04 — TLS PostgreSQL désactivé sans option de configuration

`pkg/db/config.go:39` impose `sslmode=disable`. Il n'est donc pas possible
d'activer la vérification TLS du serveur avec la configuration actuelle.
Les données et requêtes SQL circulent sans chiffrement PostgreSQL ; la
confidentialité éventuelle du transport dépend d'une protection extérieure.

**Correction :** rendre le mode TLS et les certificats configurables via
Viper, avec vérification du serveur en production. Réserver la désactivation
à un choix explicite de développement ou à un transport dont la protection
a été vérifiée. L'architecture réseau de production n'a pas été inspectée.

**Critère de fermeture :** connexion avec vérification du nom et de la CA,
refus d'un certificat invalide, développement local toujours fonctionnel.

### SEC-05 — Chaîne de publication non entièrement épinglée

`.github/workflows/build.yaml:81` utilise
`marvinpinto/action-automatic-releases@latest` dans un job disposant de
`contents: write`, `packages: write` et `id-token: write` (ligne 23).
Une modification de la référence distante change le code exécuté sans
modification revue du dépôt. Une compromission aurait un impact sur les
releases et le registre. Aucune compromission de cette action n'est alléguée.

**Correction :** épingler l'action par SHA, ou la remplacer par une étape
`gh` revue ; réduire les permissions et séparer les responsabilités des jobs.
Le droit OIDC `id-token: write` n'a pas d'usage identifié dans ce workflow.

**Critère de fermeture :** aucune action tierce à référence flottante dans
les jobs privilégiés, permissions minimales documentées, CI du candidat verte.
La proposition antérieure d'automatisation des archives reste en attente
d'accord ; cette revue n'autorise ni son ajout ni une publication.

### SEC-06 — Mot de passe SMTP en clair dans le manifeste

`chart/templates/deployment.yaml:93` écrit `smtp.password` directement dans
`env[].value`. Si ce champ est renseigné, un lecteur des Deployments peut
obtenir ce secret sans permission de lecture des Secrets. La valeur figure
aussi dans les valeurs de release Helm. Les valeurs publiques par défaut
sont vides : aucune fuite d'un vrai mot de passe dans Git n'est démontrée.

**Correction :** proposer une référence à un Secret existant, injectée dans
la variable déjà utilisée `APP_SMTP_PASSWORD`, sans placer le mot de passe
dans les valeurs du chart. Cela complète la correction de SEC-01.

**Critère de fermeture :** rendu avec `secretKeyRef`, absence de valeur
sensible dans le Deployment et les valeurs Helm conservées ; SMTP
authentifié testé avec TLS activé et validation de certificat.

## Protections examinées et contrôles réussis

- Sessions OIDC opaques, jetons de session et CSRF stockés sous forme de
  hachés, cookies HttpOnly/SameSite et Secure sur origine HTTPS ; PKCE,
  state lié au navigateur, nonce, signature, issuer, audience et azp vérifiés.
- Origine et CSRF contrôlés sur les écritures ; refus des Bearer tokens en
  mode session. Comptes nouveaux inactifs ; droits relus en base ; liaison
  d'identité explicite et protection du dernier administrateur actif.
- Routes métier authentifiées, permissions d'écriture côté serveur,
  relations budget/cotisation/paiement vérifiées, montants bornés en centimes,
  transactions et verrou partagé des opérations financières.
- Réservations atomiques des e-mails, absence de renvoi silencieux après
  résultat SMTP incertain ; synchronisation OVH réservée aux administrateurs,
  comparaison de l'aperçu et vérification des tâches en cours.
- Six sondes GET sans session sur les utilisateurs, membres, lots, budgets,
  modèles d'e-mail et visite guidée reçoivent HTTP 401 sur le serveur local.
- Audit npm rafraîchi : zéro vulnérabilité. Audit du binaire réel rafraîchi :
  aucun symbole appelé vulnérable ; un avis subsiste dans un module requis
  sans chemin d'appel détecté. Le binaire correspond au code `7af5b40`, dont
  `9406842` ne diffère que par la documentation.
- Recherche de quatre familles de signatures de secrets : aucune
  correspondance dans 412 fichiers suivis et 830 blobs non publiés depuis
  `origin/master`. Cette recherche ciblée ne couvre pas toutes les formes
  de secrets, notamment les valeurs arbitraires sans signature reconnaissable.

Les tests complets Go/PostgreSQL/Smocker, le détecteur de concurrence,
`go vet`, les 146 tests Angular, les 20 tests auxiliaires et les builds
réussis du précontrôle sont réutilisés : le code applicatif n'a pas changé.
Les nouvelles preuves HTTP utilisent les vrais middlewares d'autorisation,
routes et contrôleurs avec un fournisseur d'identité simulé et PostgreSQL
jetable ; elles ne sont pas des connexions Google réelles. La base jetable
a été supprimée après confirmation de zéro base de test résiduelle.

## Durcissements complémentaires

- Le serveur local ne fournit pas de CSP, `frame-ancestors`/X-Frame-Options,
  `nosniff` ni HSTS. Vérifier leur configuration à l'origine HTTPS de
  production ; tester une CSP compatible avec Angular et la connexion Google.
- Le CORS de l'API autorise toute origine sans credentials. Aucun contournement
  du contrôle CSRF n'a été démontré ; restreindre cette politique aux besoins.
- Compléter les exclusions du contexte Docker pour `.env`, sauvegardes et
  fichiers de clés ; ils ne sont pas tous couverts par `.dockerignore`.
- Réduire les privilèges Kubernetes et éviter le jeton de ServiceAccount
  monté automatiquement si l'application n'utilise pas l'API Kubernetes.

## Conditions de levée de l'avis défavorable

- [ ] Corriger SEC-01 et réussir les tests négatifs de non-divulgation.
- [ ] Alléger le pixel public (SEC-02) et vérifier les limites de ressources (SEC-03).
- [ ] Sécuriser le workflow privilégié (SEC-05) avant de déclencher une release.
- [ ] Traiter SEC-04 et SEC-06 selon l'architecture et le SMTP de production.
- [ ] Obtenir une CI complète verte, avec les contrôles Helm effectivement exécutés.
- [ ] Valider la configuration réelle HTTPS/OIDC/SMTP/OVH, les droits Kubernetes,
      les sauvegardes et migrations sur copie restaurée avant mise en production.

Le périmètre comprend le code, la configuration déclarée et des vérifications
locales isolées. La production, ses secrets et son Ingress n'ont pas été
inspectés. Helm est absent du poste ; aucune validation de rendu locale
n'est revendiquée. Aucun scan complet des paquets OS d'image ni test de
charge ou d'intrusion sur une cible distante n'a été effectué.
