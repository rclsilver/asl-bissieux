# Synchronisation des listes OVH

Les deux listes **Membres** et **Bureau** sont synchronisées manuellement depuis l’écran administrateur « Listes de diffusion ». La liste Membres contient les e-mails valides de toutes les fiches membres actives. Bureau contient ceux des fiches cochées **Membre du bureau**. Les adresses sont normalisées (espaces de bord retirés, minuscules) et dédupliquées ; une personne multi-lots ou une adresse partagée n’est inscrite qu’une fois. L’appartenance au bureau ne confère aucun droit applicatif.

Les règles ont été confirmées par Thomas le 21 octobre 2026 : case Bureau, ajouts **et retraits**. Les membres supprimés ou les changements d’e-mail sont pris en compte dans l’aperçu suivant. Une fiche sans e-mail ou avec une adresse invalide bloque l’application pour éviter des retraits fondés sur un annuaire incomplet.

## Configuration côté serveur

Les identifiants et cibles sont lus et validés dans l’environnement du processus serveur avant la création du client officiel OVH. La configuration historique Viper du reste de l’application conserve son fonctionnement.

| Variable | Valeur attendue |
| --- | --- |
| `OVH_ENDPOINT` | Nom d’endpoint officiel, par exemple `ovh-eu` |
| `OVH_APPLICATION_KEY` | Application key OVH |
| `OVH_APPLICATION_SECRET` | Application secret OVH |
| `OVH_CONSUMER_KEY` | Consumer key OVH |
| `APP_ML_DOMAIN` | Domaine hébergeant les listes, par exemple `example.invalid` |
| `APP_ML_MEMBERS` | Nom local de la liste Membres, par exemple `membres` |
| `APP_ML_BUREAU` | Nom local de la liste Bureau, par exemple `bureau` |

Les sept variables sont requises dès que l’une est renseignée. Une configuration partielle ou invalide bloque les opérations, sans afficher les valeurs secrètes. Si elles sont toutes absentes ou vides, la fonction reste non configurée et ne contacte pas OVH. L’endpoint n’a pas de valeur implicite ; aucun endpoint HTTP arbitraire n’est accepté. Les noms de listes sont **sans `@domaine`** et doivent être distincts.

`dev/ovh-mailing-lists.env.example` contient uniquement des valeurs fictives. Docker Compose transmet ces variables au service `server` depuis l’environnement hôte ou le fichier `.env` à la racine, ignoré par Git. Un override privé peut aussi les définir dans `server.environment`. Après modification, **recréer** le conteneur pour charger son nouvel environnement :

```sh
docker compose up -d --no-deps server
```

Un simple `restart` ne recharge pas les variables Compose. Ne jamais mettre les valeurs réelles dans Git, Angular, les logs ou une commande affichée. Les identifiants Google ne sont pas des identifiants OVH.

Le chart Kubernetes accepte `mailingLists.existingSecret` : le Secret existant doit contenir les sept clés portant exactement les noms ci-dessus. Elles sont injectées via `secretKeyRef` dans l’environnement, sans montage de fichier. Le Secret OIDC reste indépendant. **Helm étant absent du poste, lint et rendu du chart n’ont pas été exécutés.** Aucune configuration distante n’est créée par cette livraison.

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

**Les identifiants et cibles réels n’ont pas encore été fournis. Aucune liste OVH réelle n’a été lue ou modifiée, et la validation réelle reste à effectuer après configuration.** Sans ces variables, l’écran affiche explicitement que la connexion reste à configurer.

### Contrôle opérateur sans écriture

```sh
docker compose run --rm --no-deps server mailing-lists check
```

Cette commande utilise la même configuration et le même calcul que l’interface.
Elle imprime uniquement des compteurs par groupe et le statut vérifié, jamais
les identifiants ni les adresses. Sans variables OVH et APP_ML, elle retourne
`configured: false` et `verified: false` sans requête OVH. Elle n’applique aucun
changement et peut servir à vérifier la configuration avant la première synchronisation.
