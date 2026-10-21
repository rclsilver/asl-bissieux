# Terminologie de l’interface

L’interface de gestion utilise le français et conserve les termes métier déjà présents.

| Concept | Terme utilisé |
| --- | --- |
| Unit | Lot |
| Member | Membre |
| User | Utilisateur ; « compte » pour son identifiant de connexion |
| Share | Part ; « parts » dans les totaux et colonnes |
| Draft / published budget | Budget brouillon / publié |
| Amount / paid / remaining | Montant / réglé / solde |
| Campaign / template / attachment | Campagne / modèle / pièce jointe |

Les boutons nomment l’opération dans leur nom accessible et leur infobulle ; l’ajout reste un bouton « + » compact et coloré, sans texte visible à côté. Exemples de noms : « Ajouter un membre », « Modifier », « Supprimer », « Actualiser la liste ». Une confirmation reprend le verbe de l’action ; l’alternative est « Annuler ».

« Préparer les e-mails » ouvre la préparation à partir d’un budget et ne désigne pas un envoi immédiat. « Envoyer » déclenche le parcours d’envoi existant. Les états et restrictions d’envoi gardent leurs règles métier.

Une liste vide, une recherche sans résultat et une erreur de chargement ont des messages distincts. Une erreur propose de réessayer et une recherche sans résultat permet d’effacer le filtre. Les détails HTTP ne sont pas le message principal de ces listes.

Les formulaires métier, leurs validations et leurs notifications utilisent également le français. Pendant un enregistrement, la saisie et les actions sont protégées ; après erreur, la saisie reste disponible pour correction et reprise. Un membre créé avant un échec d’association conserve son identité pour éviter de le recréer.
