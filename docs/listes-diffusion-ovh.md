# Synchronisation des listes OVH

Les deux listes **Membres** et **Bureau** sont synchronisées manuellement depuis l’écran administrateur « Listes de diffusion ». La liste Membres contient les e-mails valides de toutes les fiches membres actives. Bureau contient ceux des fiches cochées **Membre du bureau**. Les adresses sont normalisées (espaces de bord retirés, minuscules) et dédupliquées ; une personne multi-lots ou une adresse partagée n’est inscrite qu’une fois. L’appartenance au bureau ne confère aucun droit applicatif.

Les règles ont été confirmées par Thomas le 21 octobre 2026 : case Bureau, ajouts **et retraits**. Les membres supprimés ou les changements d’e-mail sont pris en compte dans l’aperçu suivant. Une fiche sans e-mail ou avec une adresse invalide bloque l’application pour éviter des retraits fondés sur un annuaire incomplet.

## Configuration côté serveur

Les cibles des listes utilisent le chargeur **Viper** existant, dans la section `ml`. Elles peuvent être définies dans les fichiers YAML de l’application, via les variables `APP_ML_*` ou les options `--ml-domain`, `--ml-members`, `--ml-bureau`. La priorité habituelle est conservée : options de commande, environnement, puis YAML. Les identifiants du client officiel OVH conservent les noms standard `OVH_*` dans l’environnement, hors du préfixe applicatif `APP`.

Exemple de section YAML (valeurs fictives) :

```yaml
ml:
  domain: example.invalid
  members: membres
  bureau: bureau
```

| Variable | Valeur attendue |
| --- | --- |
| `OVH_ENDPOINT` | Nom d’endpoint officiel, par exemple `ovh-eu` ; URL HTTP(S) explicite pour Smocker |
| `OVH_APPLICATION_KEY` | Application key OVH |
| `OVH_APPLICATION_SECRET` | Application secret OVH |
| `OVH_CONSUMER_KEY` | Consumer key OVH |
| `APP_ML_DOMAIN` | Domaine hébergeant les listes, par exemple `example.invalid` |
| `APP_ML_MEMBERS` | Nom local de la liste Membres, par exemple `membres` |
| `APP_ML_BUREAU` | Nom local de la liste Bureau, par exemple `bureau` |

Les sept paramètres sont requis dès que l’un est renseigné. Les trois cibles peuvent venir de Viper plutôt que de variables d’environnement. Une configuration partielle ou invalide bloque les opérations, sans afficher les valeurs secrètes. Si tous les paramètres sont absents ou vides, la fonction reste non configurée et ne contacte pas OVH. L’endpoint n’a pas de valeur implicite. Les noms de listes sont **sans `@domaine`** et doivent être distincts. Une URL d’endpoint ne doit contenir ni identifiants, ni paramètres, ni fragment, ni barre oblique finale.

En production, définir directement les quatre variables standard du client Go OVH `OVH_*` et les trois variables applicatives `APP_ML_*` ci-dessus. Aucun `APP_ML_*` supplémentaire n’est nécessaire pour les identifiants ou le mode de simulation. `dev/ovh-mailing-lists.env.example` décrit cette configuration avec des valeurs fictives. Le chart accepte `mailingLists.existingSecret` : le Secret existant doit contenir les sept clés portant exactement ces noms. Elles sont injectées via `secretKeyRef` dans l’environnement, sans montage de fichier. Le Secret OIDC reste indépendant. **Helm étant absent du poste, lint et rendu du chart n’ont pas été exécutés.** Aucune configuration distante n’est créée par cette livraison.

Le Compose public est réservé au développement : il fixe une configuration Smocker fictive et ne reprend pas les identifiants OVH de l’environnement hôte. Après modification d’un environnement Compose privé, **recréer** le conteneur pour charger ses nouvelles variables :

```sh
docker compose up -d --no-deps server
```

Un simple `restart` ne recharge pas les variables Compose. Ne jamais mettre les valeurs réelles dans Git, Angular, les logs ou une commande affichée. Les identifiants Google ne sont pas des identifiants OVH.

Les droits du consumer key OVH doivent permettre GET, POST et DELETE des abonnés des deux listes ciblées, ainsi que GET de `/email/domain/{domain}/task/mailinglist` pour vérifier les opérations en attente. L’application ne modifie ni les modérateurs, ni les paramètres ou l’existence des listes. Restreindre la clé aux ressources concernées.

## Développement avec Smocker

`docker compose up -d` démarre et initialise automatiquement **Smocker 1.0.0** ainsi qu’un service `ovh-fixture` réservé au développement. Le backend utilise exactement le client Go OVH habituel, avec `OVH_ENDPOINT=http://smocker:8180` et des identifiants fictifs. Le domaine est `example.invalid`, les listes `membres` et `bureau`. Les identifiants réels ne sont pas nécessaires.

Smocker répond à `/auth/time` et reçoit les appels signés des abonnés et des tâches. Les mocks vérifient les identifiants fictifs et le format de signature ; ils ne valident pas cryptographiquement la signature OVH. Son historique et ses remplacements de réponses permettent d’observer les requêtes et de simuler une erreur. Il ne possède aucune route vers l’API OVH réelle. Les routes des deux listes fictives sont relayées uniquement au service interne `ovh-fixture` pour conserver leur état ; les moteurs de réponses dynamiques de Smocker 1.0 sont sans état entre appels.

Le simulateur conserve uniquement en mémoire les abonnés et les tâches. Il commence avec `ancien-membre@example.invalid` dans Membres et `ancien-bureau@example.invalid` dans Bureau pour rendre les retraits visibles. Les ajouts/retraits sont mis en attente environ une seconde, puis visibles à la relecture. Les requêtes n’accèdent jamais à PostgreSQL et ne transmettent aucun e-mail. Une nouvelle synchronisation est bloquée tant que des tâches sont en attente.

En configuration Compose standard, l’API simulée est publiée sur `127.0.0.1:8180` et l’administration Smocker sur `127.0.0.1:8181`. Le simulateur d’état n’est pas publié. Sur le poste de validation actuel, l’override réseau hôte utilise `OVH_ENDPOINT=http://127.0.0.1:8180` et un simulateur écoutant sur `127.0.0.1:8182`. Smocker 1.0 n’a pas d’option d’adresse d’écoute : dans cet override réseau hôte, ses ports 8180/8181 écoutent sur les interfaces du poste. Ne pas y charger d’identifiants réels ; son historique contient les requêtes de développement.

### Parcours de validation locale

1. Dans une fiche membre disposant d’un e-mail valide, cocher **Membre du bureau**.
2. Ouvrir **Listes de diffusion** et actualiser : contrôler les ajouts attendus et les retraits des deux anciennes adresses fictives. Les fiches invalides doivent être corrigées avant application.
3. Appliquer : les demandes sont acceptées, sans annoncer immédiatement une synchronisation vérifiée si des tâches sont encore en attente.
4. Attendre une seconde puis actualiser : les deux listes doivent correspondre aux membres et le bouton d’application doit être désactivé faute de différence.
5. Décocher Bureau ou modifier un e-mail, puis recommencer : vérifier les retraits et ajouts correspondants. Les droits administrateur doivent rester identiques.

Les mocks sont rechargés à chaque démarrage de Smocker. Les abonnés fictifs reviennent à leur état initial au redémarrage de `ovh-fixture`, sans modifier les membres de l’application :

```sh
docker compose restart ovh-fixture smocker
```

Pour inspecter les appels, utiliser les endpoints d’administration Smocker `/history` et `/sessions/verify`. Le schéma des mocks est conservé dans `dev/smocker/ovh.json`.

## Application et vérification

1. Compléter les fiches et cocher les personnes du bureau.
2. Ouvrir « Listes de diffusion » en tant qu’administrateur puis **Actualiser l’aperçu**.
3. Vérifier les ajouts et retraits des deux listes, notamment les listes qui seraient vidées.
4. Confirmer **Appliquer les changements**. Un jeton lie cette confirmation aux membres, aux listes lues et à la configuration. Tout changement exige un nouvel aperçu ; les exécutions concurrentes sont sérialisées côté serveur.
5. Actualiser après le traitement OVH. Les modifications sont asynchrones : le seul message de succès complet est affiché après relecture et comparaison des deux listes. Des tâches en attente bloquent une nouvelle application. Une erreur ou un délai dépassé ne déclenche aucune relance automatique ; une opération peut déjà avoir été acceptée, même si sa réponse est perdue.

Le bouton ne crée pas de tâche récurrente et les modifications d’annuaire ne déclenchent pas une écriture OVH à elles seules. Les erreurs partielles doivent être examinées puis reprises à partir d’un aperçu récent.

## Validation réalisée et limite actuelle

Tests avec API OVH locale simulée : signature et routes, calcul des groupes/doublons, retraits, jeton périmé, tâches en attente, résultat partiel, idempotence et absence de valeurs secrètes dans les erreurs. Tests HTTP : lecture et synchronisation réservées à l’administrateur, conservation/désactivation du rôle Bureau. Tests Angular : confirmation périmée, doubles clics, erreurs, reprise et retrait dynamique des droits.

Un test de contrat supplémentaire traverse une vraie instance Smocker jetable et le client officiel : aperçu, confirmation obsolète, ajouts/retraits des deux listes, tâches en attente, relecture exacte, absence de réapplication, modification d’e-mail et du rôle Bureau, réponse 503. Il utilise une base PostgreSQL isolée. `TEST_SMOCKER=1` active ce test avec un Smocker distinct sur 8280/8281 et `TEST_DATABASE_URL` ; il ne faut pas réutiliser le Smocker de validation sur 8180/8181, car ce test réinitialise ses mocks de test.

Migration `0007_member_bureau.sql` additive : initialisation à faux pour les membres existants, sans déduire l’appartenance de leurs droits. Vérifiée sur base neuve et copie restaurée ; les anciennes colonnes et les droits sont préservés.

**Les identifiants et cibles de production n’ont pas encore été fournis. Aucune liste OVH réelle n’a été lue ou modifiée : la validation locale utilise Smocker.** Sans aucune configuration, l’écran affiche que la connexion reste à configurer.

### Contrôle opérateur sans écriture

```sh
docker compose run --rm --no-deps server mailing-lists check
```

Cette commande utilise la même configuration et le même calcul que l’interface.
Elle imprime uniquement des compteurs par groupe et le statut vérifié, jamais
les identifiants ni les adresses. Sans configuration OVH ni cibles Viper, elle retourne
`configured: false` et `verified: false` sans requête OVH. Elle n’applique aucun
changement et peut servir à vérifier la configuration avant la première synchronisation.
