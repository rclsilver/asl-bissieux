# Fiche de validation — visite guidée

Version de référence : `tour-v1-2026-10`.

La visite livrée est en version 1. Tous les exemples sont fictifs et les simulations ne doivent créer aucune donnée métier. Seule la progression du compte est enregistrée. Les scénarios de versions ultérieures sont couverts automatiquement ; leur validation humaine nécessitera une prochaine version du tour. Aucune case n’est précochée.

## Découverte et reprise

Préparation : utiliser un compte actif n’ayant pas terminé la visite. Le menu du compte permet toujours de la revoir.

- [ ] **TOUR1 — Proposition facultative**
  Action : se connecter ; cliquer sur Plus tard puis continuer à utiliser le site. Ouvrir ensuite le menu du compte et Revoir la visite guidée.
  Attendu : une invitation apparaît au-dessus de la page ; elle n’impose aucune redirection et peut être masquée pour la session. Le parcours complet reste accessible depuis le menu du compte.
- [ ] **TOUR2 — Quitter et reprendre**
  Action : parcourir deux étapes avec Suivant, quitter la visite, puis recharger l’application et utiliser Découvrir le site.
  Attendu : les étapes validées ne sont pas reproposées dans le parcours de découverte ; Revoir la visite guidée permet de toutes les retrouver. Quitter une étape ne la marque pas comme vue.
- [ ] **TOUR3 — Terminer et consulter la fiche utilisateur**
  Action : terminer toutes les étapes proposées puis recharger. Avec un administrateur, consulter la fiche du compte dans Utilisateurs.
  Attendu : l’invitation disparaît ; la fiche indique version 1 terminée. La progression reste attachée au compte, même dans un autre navigateur. Un autre compte conserve sa propre progression.

## Exemples et autorisations

Préparation : comparer un compte actif en consultation, un compte autorisé à créer des paiements et un administrateur. Ne modifier que les droits de comptes de validation prévus à cet effet.

- [ ] **TOUR4 — Parcours adapté au compte**
  Action : ouvrir le parcours complet avec les trois profils.
  Attendu : le lecteur voit Accueil, Membres, Budgets et E-mails ; la saisie des règlements apparaît avec le droit Créer un paiement ; les comptes et listes OVH apparaissent seulement pour l’administrateur. Les conseils et boutons de modification, publication, préparation et envoi suivent leurs droits respectifs.
- [ ] **TOUR5 — Annuaire et copropriétaires fictifs**
  Action : chercher Noé puis lot 24 dans l’exemple Membres. Passer à Carte et cliquer sur le lot 1 ; fermer la fenêtre.
  Attendu : les recherches trouvent les membres d’exemple ; le lot 1 affiche Camille et Noé, avec des adresses example.invalid. Aucun membre réel n’apparaît. Le retour à la carte est possible au clavier.
- [ ] **TOUR6 — Budget et paiement simulés**
  Action : comparer brouillon et publié ; avec le profil approprié, saisir 50,001 puis 50,00 et enfin 120 dans l’exemple de règlement.
  Attendu : la différence entre prévisionnel et publié est expliquée ; le premier montant est refusé, le second laisse 50 € à payer et le dernier affiche un trop-perçu de 20 €. Aucun budget, paiement ni écriture comptable réelle n’est créé.
- [ ] **TOUR7 — E-mails et OVH simulés**
  Action : avec les droits appropriés, essayer les boutons de prévisualisation, d’envoi et de synchronisation dans la visite.
  Attendu : les résultats sont explicitement simulés. Les états et les étapes de préparation sont expliqués ; aucun message n’est envoyé, aucune campagne créée et aucune liste OVH modifiée.

## Nouveautés et confort

Préparation : les tests automatiques utilisent un catalogue fictif de versions 2 et 3 pour éprouver les différences ; la version réellement livrée reste 1.

- [ ] **TOUR8 — Nouveautés d’une version ultérieure**
  Action : lors d’une prochaine livraison du tour, revenir avec un compte ayant terminé la version précédente et choisir Voir les nouveautés.
  Attendu : seules les étapes ajoutées ou révisées et accessibles au compte sont proposées. Ce qui a changé liste les changements depuis la révision vue ; les étapes inchangées restent accessibles en relecture complète. Marquer ce cas Bloqué si seule la version 1 est disponible.
- [ ] **TOUR9 — Changement de droits**
  Action : actualiser la session après avoir accordé à un compte de validation le droit de créer un paiement, puis rouvrir la découverte.
  Attendu : l’étape de règlement nouvellement accessible apparaît sans effacer les étapes déjà vues. Après retrait du droit et actualisation de session, elle disparaît. La validation d’une étape interdite reste refusée côté serveur.
- [ ] **TOUR10 — Clavier, thèmes et petit écran**
  Action : parcourir le tour au clavier, essayer Précédent, Suivant et les sorties ; répéter dans les deux thèmes et sur petit écran.
  Attendu : progression lisible, focus sur le titre après changement d’étape, exemples empilés sous les explications sur petit écran. Aucun débordement de la page ; tableaux défilables, fenêtres fermables et contrôles lisibles.
- [ ] **TOUR11 — Reprise après une erreur de connexion**
  Action : interrompre temporairement le réseau après l’ouverture d’une étape puis cliquer sur Suivant ; rétablir la connexion et réessayer.
  Attendu : le message explique que la progression n’a pas été enregistrée ; aucune étape n’est sautée et le bouton redevient utilisable. Recharger le parcours récupère le catalogue actuel. Le reste du site reste accessible.

**Résultat de la séance.** Noter le profil et le navigateur utilisés. La fiche des lots précédents et ses résultats sont conservés séparément.
