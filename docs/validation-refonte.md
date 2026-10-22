# Validation de la refonte — ASL Bissieux

Fiche de référence : `refonte-2026-10-v1`

Cette fiche complète les 89 tests des lots précédents, sans les remplacer ni effacer leurs résultats. Les cases ci-dessous sont réservées à ta validation humaine. Le rendu réel sur ordinateur et mobile n’a pas pu être inspecté par l’agent : aucun navigateur n’est autorisé dans cet environnement.

La direction retenue associe Bassin clair, Graphite sombre et le menu supérieur de Repères. Angular 22 est conservé ; le thème et les composants utilisent Material 3. Les données, les droits et la carte SVG sont conservés. Aucun envoi ou mouvement financier n’est nécessaire pour cette recette visuelle.

## Thèmes et connexion

Préparation : ouvre l’application locale habituelle. Le bouton soleil/lune du bandeau ouvre les trois choix de thème, même avant la connexion.

- [ ] **THEME1 — Bassin clair**
  Action : choisir « Clair · Bassin clair », puis visiter l’accueil, les membres et un budget.
  Attendu : bandeau cobalt, fond bleu eau et surfaces claires ; textes, liens, filtres et tableaux lisibles sur chaque écran.
- [ ] **THEME2 — Graphite sombre et fenêtres**
  Action : choisir « Sombre · Graphite », ouvrir un formulaire existant puis l’annuler, et ouvrir un menu ou un sélecteur.
  Attendu : le fond, les surfaces, les menus et les fenêtres suivent le thème sombre ; aucun texte sombre illisible sur fond sombre. La carte reste une figure claire et lisible.
- [ ] **THEME3 — Préférence mémorisée**
  Action : choisir le thème clair ou sombre, recharger la page puis quitter et rouvrir l’application.
  Attendu : le choix est conservé lorsque le navigateur autorise son stockage ; aucune modification des données métier.
- [ ] **THEME4 — Suivre le système**
  Action : choisir « Suivre le système » et modifier le thème de l’appareil. Choisir ensuite explicitement « Clair », puis changer à nouveau le thème de l’appareil.
  Attendu : l’application suit l’appareil seulement en mode système ; le choix explicite reste prioritaire.
- [ ] **AUTHR1 — Connexion Google et compte**
  Action : se déconnecter puis revenir avec Google, ouvrir le menu du compte et consulter l’identité complète.
  Attendu : le parcours Google habituel fonctionne ; la présentation et le thème restent cohérents ; compte et droits habituels conservés.

## Navigation et écrans de gestion

Préparation : tester sur une fenêtre large puis sur un téléphone ou une fenêtre étroite. Certaines entrées dépendent des droits du compte utilisé.

- [ ] **NAVR1 — Navigation supérieure**
  Action : parcourir Accueil, Budgets, Lots, Membres et E-mails ; avec un compte administrateur, vérifier aussi Utilisateurs et Listes de diffusion.
  Attendu : menu en haut sur grand écran, destination active identifiable, actions d’administration visibles uniquement selon les droits habituels ; pas de bande latérale vide.
- [ ] **NAVR2 — Menu mobile**
  Action : ouvrir le menu mobile, sélectionner une destination, le rouvrir puis fermer par le fond extérieur ; changer de thème.
  Attendu : ouverture et fermeture correctes, destination accessible, contrôles utilisables sans débordement du bandeau.
- [ ] **NAVR3 — Tableaux, formulaires et annuaire**
  Action : rechercher et trier une liste ; consulter l’annuaire puis la carte des membres ; ouvrir un formulaire et l’annuler.
  Attendu : tableaux et contrôles cohérents avec le thème, boutons + compacts, recherche et boutons Annuaire/Carte toujours alignés ; aucune perte de fonction ni sauvegarde à l’annulation.

## Carte et paiements

Préparation : sélectionner un budget publié comportant des cotisations. Un brouillon reste prévisionnel et n’affiche pas la carte des paiements. Le dernier budget créé reste sélectionné par défaut en l’absence de choix dans l’URL.

- [ ] **MAPR1 — Situation et budget**
  Action : comparer les quatre indicateurs de l’accueil avec les détails du budget ; changer de budget et ouvrir « Comprendre les indicateurs ».
  Attendu : chiffres et périmètres habituels conservés ; explications accessibles ; distinction nette entre publié et brouillon.
- [ ] **MAPR2 — Recherche depuis la carte**
  Action : rechercher un nom de membre, puis un numéro tel que « lot 24 », une adresse et une coordonnée connue ; essayer aussi sans accents ou avec une casse différente.
  Attendu : les lots correspondants sont signalés sur la carte et proposés comme résultats ; la couleur de leur état financier reste visible.
- [ ] **MAPR3 — Aucun résultat et effacement**
  Action : saisir un texte sans correspondance, puis effacer la recherche.
  Attendu : zéro lot trouvé est annoncé ; aucun état financier n’est perdu ; la carte et la recherche restent utilisables.
- [ ] **MAPR4 — Sélection et détail**
  Action : sélectionner un lot sur la carte puis depuis les résultats ; consulter ses membres et son historique ; essayer un lot sans cotisation si disponible.
  Attendu : détail associé à la bonne sélection, copropriétaires conservés ; absence de cotisation distinguée d’absence de paiement ; aucun envoi ni mouvement financier automatique.
- [ ] **MAPR5 — Clavier et lot 24**
  Action : atteindre la carte au clavier, utiliser les flèches puis Entrée ou Espace ; sélectionner le lot 24 s’il est présent.
  Attendu : contour de focus lisible, pointillés conservés sans cadre inutile ; le lot 24 reçoit les mêmes états et sélections que les autres lots, sans déformation.

## Confort et validation finale

Préparation : répéter ces vérifications dans les deux thèmes. Cette séance ne remplace pas les tests fonctionnels détaillés de la fiche des lots précédents.

- [ ] **UIR1 — Petit écran**
  Action : consulter l’accueil et une longue liste sur petit écran, puis sélectionner un lot.
  Attendu : carte et détail s’empilent ; champs et boutons restent accessibles ; le défilement horizontal d’un tableau ne déplace pas toute la page.
- [ ] **UIR2 — Focus et états métier**
  Action : parcourir le bandeau et les actions au clavier ; vérifier les cinq états de la carte et, si disponible, un solde négatif dans un budget.
  Attendu : focus visible dans les deux thèmes, y compris sur le lien actif ; violet conservé pour les trop-perçus, montant à rembourser toujours mis en évidence.
- [ ] **UIR3 — Retour et rechargement**
  Action : copier l’adresse après une recherche ou une sélection, recharger, puis utiliser précédent/suivant.
  Attendu : budget, recherche et sélection cohérents avec l’adresse ; préférence de thème conservée ; aucun e-mail ni paiement créé par la consultation.

## Ajustements après la première revue

Préparation : corrections du 22 octobre 2026. Les résultats des cas précédents restent conservés. Dans la fiche des lots précédents, DB07 (ancien graphique mensuel) est désormais sans objet.

- [ ] **AJUST1 — Arrivée sans clic dans le menu**
  Action : avec une session active, ouvrir l’application à sa racine puis recharger une adresse directe de Membres avec un filtre.
  Attendu : l’accueil s’affiche dès l’arrivée ; l’adresse directe ouvre les membres avec le bon filtre ; le lien du menu correspondant est sélectionné sans clic préalable.
- [ ] **AJUST2 — Filtres intégrés aux listes**
  Action : visiter Lots, Membres, Comptes et accès, les campagnes, les e-mails d’une campagne et les cotisations d’un budget publié ; modifier puis retirer un filtre.
  Attendu : filtres, recherche, actualisation et ajout sont regroupés dans l’en-tête de la liste selon les droits et fonctions disponibles. Les filtres restent fonctionnels ; sur petit écran, les contrôles reviennent à la ligne sans faire déborder la page.
- [ ] **AJUST3 — Annuaire et carte avec le même en-tête**
  Action : chercher un membre, passer à Carte puis revenir à Annuaire, enfin effacer la recherche.
  Attendu : la recherche et les boutons Annuaire/Carte restent alignés et accessibles dans les deux vues ; les résultats sont conservés au changement de vue, puis rétablis après effacement.
- [ ] **AJUST4 — Dashboard allégé**
  Action : ouvrir un budget publié sur l’accueil ; consulter la carte, ouvrir les aides et « Comparer les budgets annuels », puis choisir une référence et recharger.
  Attendu : aucun bloc Encaissements mensuels, graphique ou tableau mensuel ; indicateurs, carte, détails du lot et points à traiter conservés. Les aides et campagnes récentes se déplient à la demande. La comparaison est repliée sans référence et s’ouvre si une référence est présente dans l’adresse.

**Résultat de la séance.** Noter les identifiants des cas en échec ou bloqués et le navigateur utilisé. La fiche HTML permet d’exporter un exemplaire rempli ou les résultats JSON. Aucun résultat n’est envoyé automatiquement et aucune case n’est précochée.
