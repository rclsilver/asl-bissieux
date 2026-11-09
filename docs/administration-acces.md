# Comptes, identités et accès

L’authentification Google ou Keycloak vérifie une identité. L’autorisation d’entrer
dans l’application vient du compte interne. Un membre de l’annuaire n’est pas un
compte de connexion, et aucune association OIDC n’est déduite de son adresse.
L’identité stable est le couple `(issuer, subject)` ; son affichage administratif
ne permet pas de la modifier. L’association explicite existante reste disponible
via la commande d’administration des identités décrite dans le README.

## Décisions d’accès

Une première connexion vérifiée, lorsque la création des comptes est autorisée,
crée un compte inactif et une demande `pending`. Les administrateurs voient ces
demandes dans **Comptes et accès**, filtre **Demandes en attente**. Le lien
`/users?status=pending` permet aussi d’y arriver depuis le tableau de bord.

Les décisions sont explicites et confirmées avec le compte et son fournisseur :

- Activer une demande en attente lui accorde l’accès avec ses droits définis.
- Refuser une demande la retire des demandes en attente et révoque ses sessions.
- Désactiver un compte actif lui retire l’accès et révoque ses sessions.
- Réactiver un compte désactivé ou refusé restaure l’accès avec les droits définis.

Les anciens comptes inactifs restent **désactivés** : la migration ne les
transforme pas en nouvelles demandes. Un refus n’est pas une suppression d’identité.
Le compte et son historique restent conservés.

**Modifier les droits** ne prend aucune décision sur une demande en attente.
Le rôle administrateur et les autorisations particulières sont distincts de
l’activation. Tout compte actif peut consulter les données métier selon les règles
existantes ; les autorisations particulières permettent les actions de modification.
Un administrateur actif dispose de tous les droits, dont la gestion des comptes.
Les autorisations historiques inconnues restent conservées lors d’une modification.

Le + prépare un compte interne inactif, sans identité associée. Il ne garantit pas
qu’une connexion OIDC ultérieure sera associée : une identité vérifiée doit être
liée explicitement. Pour les nouveaux utilisateurs ordinaires, la première
connexion suivie de l’examen de sa demande constitue le parcours recommandé.

## Protections et sessions

Les mutations administratives sont sérialisées en transaction. Le serveur relit
les droits de l’administrateur après acquisition du verrou et interdit la perte
du dernier administrateur actif, y compris lors de changements concurrents.
La suppression API historique reste une suppression logique et respecte la même
protection ; l’interface privilégie la désactivation réversible.

Les droits proviennent de la base à chaque requête, sans être repris des rôles du
jeton fournisseur. Leur changement s’applique aux requêtes suivantes de toute
session. Après une désactivation, une reconnexion au fournisseur peut toujours
vérifier l’identité, mais ne restaure aucun accès applicatif. La page de connexion
distingue attente, refus et désactivation. **Actualiser mon accès** permet de
vérifier une décision récente sans changer de compte.

Les interfaces envoient la version de la fiche qu’elles ont consultée. Une fiche
modifiée entre-temps est refusée : fermer le dialogue, actualiser la liste et
reprendre la décision. Les anciennes intégrations API peuvent omettre ce contrôle
optimiste ; la protection du dernier administrateur reste toujours imposée.

Le compteur de demandes et les identités des autres comptes sont réservés aux
administrateurs côté API. Le compteur ne donne que le nombre de demandes en attente.
La consultation du compte courant ne transmet pas les identités d’autres comptes.

## Migration et vérification

`0006_access_requests.sql` ajoute une table sans modifier les comptes, identités,
droits ou sessions existants. Appliquer après sauvegarde et validation sur copie
restaurée, suivant la procédure des migrations.

Les tests utilisent des bases PostgreSQL jetables et des fournisseurs simulés :
création d’une demande OIDC, séparation des états, permissions, refus/réactivation,
révocation de sessions, version de fiche périmée, concurrence entre administrateurs
et maintien d’au moins un administrateur actif. Aucun compte réel n’est désactivé
par les vérifications automatiques.
