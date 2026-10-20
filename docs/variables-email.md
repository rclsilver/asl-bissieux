# Données de personnalisation des e-mails

Le moteur conserve la syntaxe Go text/template et les fonctions Sprig. Les clés absentes provoquent une erreur de rendu (`missingkey=error`). L’objet du message et son corps sont rendus côté serveur ; le corps Markdown est ensuite converti en HTML.

## Contexte automatique des campagnes de budget

`controllers/budgets.go`, fonctions `buildTemplateData` et `buildTemplate`, fournit les racines suivantes. Les noms de propriétés sont ceux des JSON des modèles Go.

| Donnée | Exemples de propriétés | Sens |
| --- | --- | --- |
| `member` | `first_name`, `last_name`, `email`, `phone_number`, `address` | Membre destinataire |
| `budget` | `label`, `amount`, `paid`, `draft` | Budget et totaux globaux du budget |
| `amount` | Valeur scalaire | Somme des cotisations incluses pour ce membre ; ce n’est pas son solde restant |
| `cotisations` | `unit.number`, `unit.address`, `unit.share`, `amount`, `paid`, `remaining`, `payment_state` | Liste des cotisations du membre retenues par les critères de préparation |
| `expenses` | `label`, `amount` | Liste des dépenses du budget |

Exemples conservant la syntaxe existante :

```gotemplate
Bonjour {{.member.first_name}} {{.member.last_name}},
Budget : {{.budget.label}}
{{range .cotisations}}Lot {{.unit.number}} : {{.amount}} appelés, {{.paid}} réglés.
{{end}}
```

Le contexte est sérialisé en JSON avant son utilisation : les clés sont en minuscules et les montants sont des valeurs numériques. Les listes `cotisations` et `expenses` nécessitent une itération ; une variable d’un élément s’utilise à l’intérieur de cette itération. Des identifiants et autres propriétés des modèles peuvent aussi exister, mais le tableau décrit les variables métier utiles à l’interface.

## Critères de destinataires

Les cotisations réglées à moins de la moitié sont incluses par défaut. Deux options ajoutent celles réglées au moins à moitié mais non soldées, et celles soldées ou en trop-perçu. La comparaison utilise les décimaux exacts côté serveur.

Les membres sans adresse e-mail sont exclus de la préparation. Le regroupement utilise l’identifiant du membre, pas son adresse : une personne propriétaire de plusieurs lots reçoit un message avec ses cotisations incluses ; les copropriétaires sont des destinataires distincts.

Le nouvel aperçu accepte `send_to_doing` et `send_to_paid`. Lorsque ces champs sont fournis, il utilise les mêmes critères que la préparation et refuse un membre exclu ou sans adresse. Leur omission conserve l’ancien aperçu de toutes les cotisations du membre.

## Valeurs supplémentaires et compatibilité

Les valeurs saisies pour une campagne sont ajoutées à la racine du contexte. Exemple : `{ "date_limite": "31 décembre" }` s’utilise avec `{{.date_limite}}`. Les modèles existants peuvent utiliser des objets, listes, types numériques/booléens et fonctions Sprig. Un mode avancé doit conserver ces données sans les réduire à de simples chaînes.

Le moteur existant permet à ces données de remplacer une racine automatique portant le même nom ; l’interface ne doit pas supprimer silencieusement une telle valeur lors de la lecture d’un ancien paramétrage.

La prévisualisation générique d’un modèle (`email/templates/:id/preview`) reçoit uniquement les données fournies par l’appelant. Elle n’ajoute pas automatiquement le contexte d’un budget : ce contexte appartient à `budget/:id/email-preview` et à la préparation de campagnes.

## Préparation et envoi

L’API `budget/:id/email` crée une campagne et ses e-mails en base. Elle ne transmet aucun message au serveur SMTP. L’envoi effectif se fait ensuite depuis la campagne. Les aperçus ne créent ni campagne ni e-mail.

Avant de créer la campagne, le serveur vérifie le rendu du sujet et du corps pour chaque destinataire retenu. Un aperçu réussi pour un membre ne suffit pas : une donnée absente ou une structure différente chez un autre membre bloque la préparation avant toute création. Ce contrôle travaille sur une copie des données pour que les fonctions Sprig modifiant des objets n’altèrent pas les contextes enregistrés.
