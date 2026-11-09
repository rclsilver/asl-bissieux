# Préparation de la bascule Google OIDC en production

La connexion Google OIDC locale a été validée par Thomas : connexion, rechargement, déconnexion et reconnexion. Les sessions et permissions sont gérées côté application. Le secret reste dans un fichier privé monté côté serveur ; aucune valeur n’est documentée ici.

La cible de production et son client ne sont pas confirmés. Cette préparation ne déploie rien et ne modifie pas Google Cloud. Avant une bascule séparément autorisée :

1. Confirmer l’origine publique HTTPS, le client Google Web de cette cible et les accès opérateur. Autoriser exactement `https://ORIGINE/api/auth/callback` dans Google Cloud ; un callback local ne couvre pas la production.
2. Vérifier les identités `(issuer, subject)` de tous les comptes à conserver. Lier explicitement les comptes existants lorsque nécessaire avec `identity link`, après contrôle de l’identité. Ne jamais fusionner sur l’e-mail seul. Garder un administrateur actif opérationnel.
3. Sauvegarder la base, les références de configuration et l’image précédente. Tester la restauration à part. Relever la version des migrations ; les versions SQL appliquées ne sont jamais réécrites.
4. Préparer un Secret Kubernetes privé et une configuration OIDC. Le chart utilise `auth.provider: oidc`, `auth.client_id`, `auth.oidc.issuer`, `auth.oidc.publicURL`, `auth.oidc.existingSecret` et `auth.oidc.secretKey`. `auth.client_secret` ne configure pas le fournisseur OIDC. Le secret est monté en lecture seule, jamais transmis à Angular.
5. Exécuter `helm lint` puis `helm template` sur l'archive versionnée avec les valeurs privées de la cible et contrôler le rendu hors Git. Depuis le chart source, fournir aussi `--set-string image.tag=VERSION` ; voir [publication et release](publication-release.md). **Helm est absent de ce poste : ces deux vérifications n’ont pas été exécutées.** Vérifier TLS, origine publique, accès sortant à la découverte Google/JWKS, horloge et permissions de lecture du Secret.
6. Après autorisation explicite de déploiement, vérifier sur la cible : un compte connu retrouve son UUID et ses droits ; un inconnu reste en attente ; compte refusé/inactif sans accès ; rechargement et déconnexion ; refus d’une origine d’écriture non autorisée ; aucun jeton fournisseur dans le navigateur ou les logs applicatifs.

## Retour arrière à préparer

Conserver la configuration et l’image précédentes sans copier de secret dans les journaux. Une simple remise de l’ancien fournisseur peut rendre inaccessibles les comptes nouvellement créés uniquement en OIDC : inventorier les comptes et sessions avant de choisir la stratégie. Révoquer les sessions concernées et rétablir un accès administrateur vérifié. Un retour de code ne supprime pas les migrations additives ni les écritures métier intervenues depuis la sauvegarde. Une restauration de base ne doit être décidée qu’après arrêt des écritures et examen de ces données, avec validation opérateur.

Le suivi de production reste ouvert tant que la cible, le client, les associations, les vérifications Helm et l’autorisation ne sont pas disponibles. Aucun push ni déploiement de production n’a été effectué dans ce travail local.
