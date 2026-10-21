# Synchronisation des listes OVH

Les deux listes **Membres** et **Bureau** sont synchronisées manuellement depuis l’écran administrateur « Listes de diffusion ». La liste Membres contient les e-mails valides de toutes les fiches membres actives. Bureau contient ceux des fiches cochées **Membre du bureau**. Les adresses sont normalisées (espaces de bord retirés, minuscules) et dédupliquées ; une personne multi-lots ou une adresse partagée n’est inscrite qu’une fois. L’appartenance au bureau ne confère aucun droit applicatif.

Les règles ont été confirmées par Thomas le 21 octobre 2026 : case Bureau, ajouts **et retraits**. Les membres supprimés ou les changements d’e-mail sont pris en compte dans l’aperçu suivant. Une fiche sans e-mail ou avec une adresse invalide bloque l’application pour éviter des retraits fondés sur un annuaire incomplet.

## Configuration côté serveur

Le programme initialise **`github.com/ovh/configstore` avec `configstore.InitFromEnvironment()`** au démarrage. La configuration historique Viper/`APP_*` du serveur, de PostgreSQL et de Google conserve son fonctionnement. L’élément ConfigStore s’appelle exactement :

```
asl-bissieux-ovh-mailing-lists
```

Sa valeur est un objet JSON, décrit par `dev/ovh-mailing-lists.example.json` (valeurs fictives). Les champs requis sont `endpoint`, `application_key`, `application_secret`, `consumer_key`, `domain`, `members_list`, `bureau_list`. Les noms des listes sont les identifiants locaux OVH, **sans `@domaine`**, et doivent être distincts. L’endpoint est un nom pris en charge par le client officiel, par exemple `ovh-eu`. Aucun endpoint HTTP arbitraire n’est accepté.

Avec le fournisseur `filetree`, monter un répertoire privé en lecture seule contenant un fichier nommé `asl-bissieux-ovh-mailing-lists` et définir :

```sh
CONFIGURATION_FROM=filetree:/run/secrets/asl-configuration
```

Ce fichier contient directement le JSON, sans enveloppe YAML. Un provider `file:` est aussi possible selon le format natif ConfigStore. Après ajout d’un provider ou changement d’un fichier statique, redémarrer le backend. Ne pas mettre les valeurs réelles dans Git, Angular, les logs ou une commande affichée. Les identifiants Google ne sont pas des identifiants OVH.

Pour Docker Compose local, fournir le montage et `CONFIGURATION_FROM` dans l’override privé du service `server`. Pour le chart Kubernetes, `mailingLists.existingSecret` et `mailingLists.secretKey` montent la clé JSON d’un Secret existant sous ce nom d’élément. Ce montage est indépendant du Secret OIDC. **Helm étant absent du poste, lint et rendu du chart n’ont pas été exécutés.** Aucune configuration distante n’est créée par cette livraison.

Les droits du consumer key OVH doivent permettre GET, POST et DELETE des abonnés des deux listes ciblées, ainsi que GET de `/email/domain/{domain}/task/mailinglist` pour vérifier les opérations en attente. L’application ne modifie ni les modérateurs, ni les paramètres ou l’existence des listes. Restreindre la clé aux ressources concernées.

## Application et vérification

1. Compléter les fiches et cocher les personnes du bureau.
2. Ouvrir « Listes de diffusion » en tant qu’administrateur puis **Actualiser l’aperçu**.
3. Vérifier les ajouts et retraits des deux listes, notamment les listes qui seraient vidées.
4. Confirmer **Appliquer les changements**. Un jeton lie cette confirmation aux membres, aux listes lues et à la configuration. Tout changement exige un nouvel aperçu ; les exécutions concurrentes sont sérialisées côté serveur.
5. Actualiser après le traitement OVH. Les modifications sont asynchrones : le seul message de succès complet est affiché après relecture et comparaison des deux listes. Des tâches en attente bloquent une nouvelle application. Une erreur ou un délai dépassé ne déclenche aucune relance automatique ; une opération peut déjà avoir été acceptée, même si sa réponse est perdue.

Le bouton ne crée pas de tâche récurrente et les modifications d’annuaire ne déclenchent pas une écriture OVH à elles seules. Les erreurs partielles doivent être examinées puis reprises à partir d’un aperçu récent.

## Validation réalisée et limite actuelle

Tests avec API OVH locale simulée : signature et routes, calcul des groupes/doublons, retraits, jeton périmé, tâches en attente, résultat partiel, idempotence et absence de valeurs secrètes dans les erreurs. Tests HTTP : lecture et synchronisation réservées à l’administrateur, conservation/désactivation du rôle Bureau. Tests Angular : confirmation périmée, doubles clics, erreurs, reprise et retrait dynamique des droits.

Migration `0007_member_bureau.sql` additive : initialisation à faux pour les membres existants, sans déduire l’appartenance de leurs droits. Vérifiée sur base neuve et copie restaurée ; les anciennes colonnes et les droits sont préservés.

**Le secret réel n’a pas encore été fourni. Aucune liste OVH réelle n’a été lue ou modifiée, et la validation réelle reste à effectuer après configuration.** Sans cet élément, l’écran affiche explicitement que la connexion reste à configurer.

### Contrôle opérateur sans écriture

```sh
docker compose run --rm --no-deps server mailing-lists check
```

Cette commande utilise la même configuration et le même calcul que l’interface.
Elle imprime uniquement des compteurs par groupe et le statut vérifié, jamais
les identifiants ni les adresses. Sans élément ConfigStore, elle retourne
`configured: false` et `verified: false` sans requête OVH. Elle n’applique aucun
changement et peut servir à vérifier le secret avant la première synchronisation.
