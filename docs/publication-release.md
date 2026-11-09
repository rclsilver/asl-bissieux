# Préparer et publier une release

Ce guide prépare le candidat depuis `dev`. Le numéro de la prochaine release
reste à choisir. Aucun push, tag, publication ou déploiement de production
n'est effectué par les commandes de préparation ci-dessous.

## Identité du binaire et de l'image

`make asl-bissieux VERSION=0.0.0-ci COMMIT="$(git rev-parse HEAD)"` injecte
la version et le commit. `./asl-bissieux --version` les affiche sans charger
la configuration ni contacter la base. `go run main.go --version` affiche
les valeurs de développement `dev` et `unknown`.

Le build Docker accepte les mêmes arguments `VERSION` et `COMMIT` et les
inscrit aussi dans les labels OCI. La CI utilise le tag exact `vX.Y.Z` pour
une release et `0.0.0-dev.g<commit-complet>` sur une branche. La version du
binaire, le label et le tag de l'image désignent ainsi le même candidat.

La CI existante publie déjà les images sur `ghcr.io/rclsilver/asl-bissieux`
et crée une release GitHub sur un tag de version. Modifier les sources
localement ne déclenche pas ces workflows. Leur validation doit réussir
avant toute publication d'image.

## Archive Helm

Le chart source porte la version de travail `0.0.0-dev`, sans `appVersion`.
Son rendu nécessite donc `--set-string image.tag=VERSION`. Il ne choisit
plus implicitement `latest`. Le registre par défaut est GHCR.

Sur une machine équipée de Helm, préparer une archive avec la version
retenue et un répertoire de sortie privé :

```sh
bash dev/package-chart.sh vX.Y.Z REPERTOIRE_DE_SORTIE
```

Remplacer les deux arguments. Le script produit `asl-bissieux-X.Y.Z.tgz`,
`SHA256SUMS` et un rendu avec les seules valeurs publiques par défaut.
Il exécute `helm lint --strict` et `helm template` sur l'archive. Sa version
est `X.Y.Z`, son `appVersion` est `vX.Y.Z` et l'image par défaut est
`ghcr.io/rclsilver/asl-bissieux:vX.Y.Z`. Aucun téléversement ni déploiement.

Un `image.tag` explicite reste prioritaire, y compris s'il provient d'anciennes
valeurs de déploiement. Le supprimer ou le remplacer pour tester l'image
de la nouvelle archive. Avant production, contrôler aussi le rendu avec les
valeurs réelles dans un emplacement privé, sans l'ajouter à Git.

Les tests `go test ./chart` contrôlent le refus d'une image sans version,
le registre, l'archive et sa version, les surcharges, ainsi que les références
aux Secrets OIDC et OVH. Ils sont ignorés explicitement si Helm manque.
`REQUIRE_HELM=1 go test ./chart` transforme cette absence en échec ; la CI
installe une version épinglée de Helm et impose ce contrôle.

Helm est absent du poste actuel : aucun succès local de lint, rendu ou
packaging n'est revendiqué. Les tests doivent encore passer sur la CI du
candidat publié. L'attachement automatique de l'archive à la release reste
une proposition soumise à accord ; il n'est pas implémenté.

## Notes de release à reprendre

Depuis `v0.1.0` :

- Cotisations en centimes exacts, gel des budgets publiés, paiements fiables,
  remboursements et corrections tracés dans un journal immuable.
- E-mails réservés avant envoi, états de livraison explicites, historique et
  campagnes paginés, préparation guidée et variables de modèles vérifiées.
- Connexion OIDC, sessions serveur, demandes d'accès et permissions internes ;
  conservation explicite des identités historiques lors de la bascule.
- Synchronisation administrateur des listes OVH membres/bureau, aperçu des
  différences et vérification des tâches ; simulation Smocker en développement.
- Nouvelle interface, thèmes clairs et sombres, navigation et filtres harmonisés,
  annuaire et cartes, fiche de cotisations adaptée aux petits écrans.
- Visite guidée versionnée selon les droits, exemples fictifs et progression
  persistante par utilisateur.
- Migrations SQL versionnées jusqu'à `0008`, contrôles CI et images actualisés.

Le tour v1 a été validé. La recette finale de la fenêtre de cotisations sur
mobile et les derniers ajustements visuels restent à faire avec Thomas.
Consulter les fiches de validation des lots, de la refonte et du tour.

## Précontrôle local du candidat

Contrôles terminés sur le code du commit `7af5b40`, avant les seules mises
à jour de documentation :

- [x] 146 tests Angular et 20 tests auxiliaires, puis build de production.
- [x] Audit npm sans vulnérabilité après correction de `fast-uri` en 3.1.9.
- [x] Tests Go avec PostgreSQL et Smocker jetables, détecteur de concurrence
      sur l'authentification, `go vet` et `go mod verify` avec Go 1.27.3.
- [x] Audit des sources et des vrais binaires application/SMTP reconstruits :
      aucun symbole appelé vulnérable. Un avis reste dans un module requis
      sans chemin d'appel détecté ; ces contrôles ne constituent pas un audit exhaustif.
- [x] Image locale finale compilée avec `VERSION=0.0.0-ci` et SHA complet
      `7af5b405ff6044ff4943aafe9a4fa8555ebf8979`, vérifiés via `--version`
      et les labels OCI ; utilisateur non privilégié 10001.
- [x] Syntaxe YAML et shell des workflows, versions générées sur branche/tag
      et transmission des arguments de build vérifiées sans publication.
- [x] Backend local remis à jour avec Go 1.27.3, frontend redémarré,
      sept services sains, fichiers servis identiques au build et Google OIDC conservé.
- [x] Services de test jetables supprimés après vérification de l'absence
      de bases temporaires résiduelles.
- [ ] Helm lint/rendu/packaging : outil absent localement, contrôles préparés en CI.
- [ ] CI distante du nouveau candidat : pas encore exécutée, aucun push effectué.

Les avertissements de taille Angular existants subsistent, sans erreur de
build. L'image SMTP corrigée est construite et auditée ; son service et le
simulateur OVH n'ont pas été recréés pour conserver leurs données en mémoire.
Leur prochaine recréation utilisera les nouvelles images locales. Aucune
nouvelle migration ni modification de données métier n'est incluse dans
ce précontrôle ; aucune intervention de production.

## Portes de validation avant production

- [ ] Choisir le numéro de version et valider les notes de release.
- [ ] Terminer la recette visuelle finale, notamment les cotisations sur mobile.
- [ ] Obtenir une CI complète verte sur le commit candidat, avec Helm obligatoire.
- [ ] Autoriser séparément la publication, puis vérifier les images et leurs digests.
- [ ] Générer, contrôler et joindre l'archive Helm et son empreinte.
- [ ] Confirmer origine HTTPS, client Google, callback et identités conservées,
      avec un administrateur opérationnel ; voir `production-oidc.md`.
- [ ] Confirmer SMTP, TLS, expéditeur et URL de suivi, ainsi que les cibles
      `APP_ML_DOMAIN`, `APP_ML_MEMBERS`, `APP_ML_BUREAU` et les Secrets `OVH_*`.
      Les tests Smocker ne valent pas validation des listes OVH réelles.
- [ ] Sauvegarder base, configuration et image précédente ; tester la restauration
      et les migrations jusqu'à `0008` sur une copie de production.
- [ ] Examiner `db.migrate` avant démarrage : la configuration embarquée l'active.
      Éviter une application involontaire des migrations par le premier pod.
- [ ] Préparer le retour arrière sans inverser les migrations ni perdre les
      écritures métier ; autoriser séparément le déploiement et ses vérifications.
