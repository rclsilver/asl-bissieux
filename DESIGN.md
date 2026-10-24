---
name: ASL Bissieux
description: Bassin clair et Graphite, une interface de gestion précise autour de la carte des lots.
colors:
  light-ground: "#eef6fa"
  light-surface: "#fff"
  light-raised: "#f4f8fc"
  light-border: "#cbdce8"
  light-ink: "#142b48"
  light-muted: "#52697d"
  light-primary: "#124dc5"
  light-on-primary: "#fff"
  light-tint: "#e5efff"
  light-header: "#1246ae"
  light-header-ink: "#fff"
  light-nav-active: "#fff"
  light-nav-ink: "#1244a8"
  light-error: "#a72d36"
  light-on-error: "#fff"
  light-error-tint: "#ffedef"
  light-warning: "#855100"
  light-surplus: "#6d28d9"
  light-surplus-tint: "#f5f3ff"
  dark-ground: "#101821"
  dark-surface: "#19232e"
  dark-raised: "#22303e"
  dark-border: "#3b4e60"
  dark-ink: "#e5edf6"
  dark-muted: "#adbdcf"
  dark-primary: "#a8d8ff"
  dark-on-primary: "#123149"
  dark-tint: "#253b50"
  dark-header: "#0c131b"
  dark-header-ink: "#e5edf6"
  dark-nav-active: "#273e54"
  dark-nav-ink: "#b6dfff"
  dark-error: "#ffb4ab"
  dark-on-error: "#512a2a"
  dark-error-tint: "#512a2a"
  dark-warning: "#f3c77e"
  dark-surplus: "#d3b5ff"
  dark-surplus-tint: "#342545"
  map-settled: "#a6ddba"
  map-partial: "#fac580"
  map-unpaid: "#ed9da7"
  map-overpaid: "#c4a3e8"
  map-neutral: "#d4dce2"
  map-focus: "#124dc5"
  map-ground: "#f8fbfd"
  map-label: "#183b35"
typography:
  headline:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: "clamp(1.75rem, 2.6vw, 2.25rem)"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: "1.4rem"
    fontWeight: 650
    lineHeight: "1.3"
  subtitle:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: "1.1rem"
    fontWeight: 650
    lineHeight: "1.4"
  body:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: "16px"
    lineHeight: "1.5"
  label:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    letterSpacing: "0"
  metric:
    fontFamily: '"Segoe UI", Roboto, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 650
rounded:
  status: "6px"
  navigation: "8px"
  control: "10px"
  map: "12px"
  surface: "16px"
  dialog: "20px"
  authentication: "24px"
spacing:
  quarter: "0.25rem"
  half: "0.5rem"
  three-quarter: "0.75rem"
  unit: "1rem"
  section: "1.5rem"
  major: "2rem"
  page-bottom: "3rem"
components:
  button-primary-light:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  field:
    rounded: "{rounded.control}"
  button-warn-light:
    backgroundColor: "{colors.light-error}"
    textColor: "{colors.light-on-error}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  button-warn-dark:
    backgroundColor: "{colors.dark-error}"
    textColor: "{colors.dark-on-error}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  button-accent-light:
    backgroundColor: "{colors.light-raised}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  button-accent-dark:
    backgroundColor: "{colors.dark-raised}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  navigation-active-light:
    backgroundColor: "{colors.light-nav-active}"
    textColor: "{colors.light-nav-ink}"
    rounded: "{rounded.navigation}"
    padding: "10px 12px"
  navigation-active-dark:
    backgroundColor: "{colors.dark-nav-active}"
    textColor: "{colors.dark-nav-ink}"
    rounded: "{rounded.navigation}"
    padding: "10px 12px"
  status-light:
    backgroundColor: "{colors.light-tint}"
    textColor: "{colors.light-primary}"
    rounded: "{rounded.status}"
    padding: "0.3rem 0.6rem"
  status-dark:
    backgroundColor: "{colors.dark-tint}"
    textColor: "{colors.dark-primary}"
    rounded: "{rounded.status}"
    padding: "0.3rem 0.6rem"
  panel-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
  panel-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.surface}"
    padding: "1.5rem"
---

# Design System: ASL Bissieux

## Overview

**Creative North Star: "Bassin clair / Graphite"**

Le monde choisi associe le cobalt, le bleu eau et les surfaces blanches de Bassin clair à une variante sombre Graphite. La navigation supérieure reprend Repères. Les surfaces unies, les séparations fines et une typographie sans empattement donnent une interface accueillante, précise et adaptée à la gestion de l’association.

La densité reste celle de Material 3 à zéro, avec des panneaux aérés et des listes compactes dans leur organisation. Les chiffres tabulaires facilitent la lecture des montants. La carte SVG constitue une matière fonctionnelle : sa couleur décrit les paiements, son contour décrit l’interaction.

**Key Characteristics:**

- Deux thèmes complets sous une même hiérarchie visuelle.
- Surfaces unies, bordures fines et angles adoucis selon le rôle.
- Navigation supérieure et commandes regroupées, repliées sur petit écran.
- Carte, recherche et détail liés sans effacer les états financiers.

Document extrait du code après la refonte : `frontend/src/styles.scss`, page et ThemeService, tableau de bord, CRUD partagé et carte interactive. Les valeurs ci-dessus sont normatives pour cette photographie du système ; le code reste la source d’implémentation. Aucune inspection du rendu dans un navigateur n’a été réalisée : le contrôle visuel ordinateur/mobile et la validation humaine restent à effectuer.

## Colors

La palette primaire est cobalt dans le thème clair et bleu eau lumineux dans Graphite ; les autres couleurs sont des neutres ou des signaux métier.

### Primary

- **Cobalt du bassin** : action principale, liens, curseur de saisie, sélection de texte et focus général dans Bassin clair.
- **Bleu eau Graphite** : mêmes rôles dans le thème sombre, avec son texte sur primaire dédié.
- **Bandeau Repères** : bleu plus profond dans le clair et fond presque noir dans Graphite. La page active utilise les rôles `nav-active` et `nav-ink`, distincts des couleurs du bandeau.

### Neutral

- **Fond bleu eau / fond Graphite** : le rôle `ground` accueille la page ; `surface` accueille les panneaux et listes ; `raised` différencie les en-têtes de tableaux et les niveaux de surface Material.
- **Encre et encre secondaire** : `ink` porte le contenu, `muted` les légendes et en-têtes. `border` fournit les séparations ; il ne remplace pas la couleur d’un texte ou d’un contour de focus.
- **Teinte de sélection** : `tint` accompagne les statuts non financiers, résultats de recherche et survols de lignes.

Les clés `light-*` et `dark-*` correspondent aux propriétés CSS `--asl-*` de même suffixe. La carte conserve ses couleurs `map-*` et son fond clair dans les deux thèmes ; ce choix garde lisibles les routes et les numéros du dessin existant.

### États métier

| Rôle | Usage |
| --- | --- |
| `map-settled` | Soldé |
| `map-partial` | Partiellement réglé |
| `map-unpaid` | Sans paiement |
| `map-overpaid` | Trop-perçu, violet |
| `map-neutral` | Sans cotisation |
| `surplus`, `surplus-tint` | Texte et fond des informations de trop-perçu hors carte |
| `error`, `error-tint` | Erreur, sans la confondre avec un état financier |
| `on-error` | Texte sur une action pleine d’erreur ou destructive |
| `warning` | Avertissement |

**The Payment Color Rule.** La sélection, les résultats de recherche et le focus ne remplacent jamais le remplissage financier d’un lot ; ils utilisent son contour.

Les paires texte/fond sont explicites et changent ensemble avec le thème. Les états de la carte sont aussi nommés dans une légende et dans le détail. Ce document ne constitue pas une certification de contraste : le rendu des états Material, des survols et des contours doit encore être vérifié visuellement.

## Typography

**Body Font:** Segoe UI, puis Roboto et sans-serif. Les contrôles Material utilisent la même famille. Il n’existe pas de police d’affichage distincte dans cette implémentation.

La hiérarchie reste sobre : titre principal fluide, titres de sections semi-gras et texte courant confortable. Les rôles `headline`, `title` et `subtitle` transcrivent respectivement les éléments h1, h2 et h3 réellement stylés ; ils ne réécrivent pas toute l’échelle interne Material.

- **Headline** : titre principal fluide, espacement resserré et lignes équilibrées.
- **Title / Subtitle** : titres de sections et sous-sections, avec graisse intermédiaire.
- **Body** : lecture courante ; les paragraphes du tableau de bord limitent leur largeur à 75ch et emploient une hauteur de ligne de 1.55.
- **Label** : texte des boutons Material ; le suivi est ramené à zéro par l’application. Navigation et aides emploient aussi fréquemment 0.875rem, sans hériter nécessairement de toutes les propriétés de ce rôle.
- **Metric** : valeurs du tableau de bord ; taille réduite à 1.3rem sur mobile. Les tableaux et indicateurs utilisent `tabular-nums`.

**The Tabular Number Rule.** Les tableaux et indicateurs financiers gardent des chiffres tabulaires pour stabiliser la comparaison des montants.

## Layout

Le cadre de page est centré et limité à 1600px. Sa marge intérieure est de 1.5rem en haut, `clamp(1rem, 3vw, 3rem)` latéralement et 2rem en bas. Le bandeau supérieur mesure au moins 76px ; il descend à 64px lorsque la navigation se replie à 1100px. Le compte textuel est masqué sous 1500px, son menu reste accessible.

À 1100px et en dessous, un bouton ouvre un tiroir modal de navigation de 18rem, plafonné à la largeur d’écran moins 3rem. À 600px et en dessous, la page emploie des marges intérieures de 1.25rem, 1rem et 2rem ; les sélecteurs prennent toute la largeur et les panneaux de carte passent à 1rem de padding.

Le rythme récurrent associe 0.5rem entre petits contrôles, 1rem dans les groupes, 1.5rem entre panneaux et 2rem entre sections. Les indicateurs se répartissent automatiquement avec une base de 12rem puis passent sur deux colonnes à 600px. La carte et son contexte utilisent deux colonnes, dont une de 16 à 20rem ; elles s’empilent à 1050px. Cette composition appartient au tableau de bord, pas à toutes les pages.

Les tables conservent leurs colonnes dans un conteneur défilant horizontalement et accessible au clavier. La barre CRUD intègre les filtres encore utiles dans l’emplacement `[table-filters]`, avec recherche, actualisation et ajout. Elle se répartit sur plusieurs lignes avec un padding de 0.5rem par 0.75rem ; les champs compacts mesurent 48px de haut. Lots et Membres n’ont plus de filtre de qualité ; la liste des campagnes n’a plus de filtre d’état. La pagination autorise le retour à la ligne et réorganise sa plage à une largeur de conteneur de 32rem. La densité Material globale reste à 0 ; les cibles d’action restent d’au moins 44px.

Les membres utilisent deux onglets Material, Annuaire et Carte. L’annuaire reprend la recherche partagée à loupe et champ repliable ; `searchFields` et `searchChange` permettent de conserver son moteur de recherche sans accents, par coordonnées ou lot. En vue carte, tout l’en-tête du tableau est masqué sans déconnecter sa source ; le clic sur un lot ouvre ses membres. Aucun champ de recherche ni sélecteur membre/lot ne surcharge la carte. Revenir à l’annuaire conserve sa recherche.

L’accueil n’affiche plus de suivi mensuel : les indicateurs de recouvrement, la carte et les points à traiter portent la lecture principale. La comparaison est repliée sans référence dans l’URL ; les explications secondaires et les campagnes récentes se déplient à la demande. Erreurs et alertes restent visibles.

## Elevation & Depth

La profondeur repose surtout sur les couches de couleur et les bordures d’un pixel. Les panneaux du tableau de bord et les listes CRUD sont plats au repos. Le panneau de connexion utilise `--asl-shadow`, ombre douce adaptée au thème ; les menus et dialogues conservent le comportement Material. Les deux valeurs d’ombre de l’application figurent dans le sidecar, sans inventer une échelle supplémentaire. Les rampes tonales du sidecar sont des métadonnées de visualisation dérivées en OKLCH ; elles ne constituent pas de nouveaux tokens de l’application.

## Shapes

Les angles distinguent les rôles : petit statut, lien de navigation, contrôle, carte, panneau, dialogue puis panneau de connexion. Le token `--asl-radius` porte le rayon des surfaces récurrentes. Boutons pleins, boutons à contour, boutons texte et champs Material partagent le rayon de contrôle. Les légendes de carte utilisent de petits disques ; les lots gardent leurs contours géographiques SVG.

## Components

### Buttons

Les boutons Material 3 pleins servent l’action principale ; les variantes à contour et texte portent les actions secondaires. Leur rayon commun est défini dans le frontmatter ; leur géométrie et leurs états internes restent fournis par Material, sans couche de dimensions inventée ici. Les boutons de l’écran de connexion ont une hauteur minimale de 48px ; les liens d’action dans le détail d’un lot ont une hauteur minimale de 44px, un padding de 12px et acceptent plusieurs lignes.

Les boutons pleins `warn` reçoivent explicitement le fond `error` et le texte `on-error` via l’API d’overrides Material 3. Les boutons pleins `accent` emploient `raised` et `ink`. Ces variantes assurent la continuité des actions existantes après le passage à Material 3 ; elles ne créent pas de nouvelle palette d’accent.

Le bouton d’ajout des listes garde une icône + sans libellé visible, une cible de 44px, un nom accessible et une infobulle. Les actions désactivées suivent les droits ou le chargement. Le focus général est un contour primaire de 2px décalé de 3px ; les boutons du bandeau utilisent l’encre du bandeau pour rester visibles.

### Chips / Statuts

Le petit statut Brouillon/Publié utilise le fond `tint`, l’encre primaire, le rayon `status` et un texte de 0.75rem. Il s’agit d’un statut informatif. Les résultats de recherche sont des boutons ; leur état sélectionné utilise primaire et texte sur primaire avec `aria-pressed`, sans changer le remplissage du lot.

### Cards / Containers

Panneaux de carte, détail et listes partagent surface, bordure fine et rayon de surface. Le détail choisi remplace la couleur de bordure par la couleur primaire. Le panneau de connexion est plus enveloppant, avec rayon et ombre dédiés. Les marges intérieures des panneaux sont réduites sur mobile.

### Inputs / Fields

Les champs Material reçoivent les encres, contours et couleurs d’erreur des variables de thème ; leurs angles reprennent les boutons. Le fond des champs remplis conserve le rôle `surface-variant` de la palette azure générée par Material : il n’est pas remplacé par `--asl-raised`. La recherche de carte porte un vrai libellé et un bouton d’effacement nommé. Le curseur de saisie et le focus utilisent primaire ; les comportements flottants, erreurs et désactivations sont ceux de Material. La largeur de recherche suit le panneau, les sélecteurs s’étendent sur petit écran.

Le budget de l’accueil, le filtre d’état dans une campagne, la situation des cotisations et l’état d’accès des utilisateurs utilisent `context-field` : apparence outline, fond surface, rayon 10px et hauteur 48px. Les filtres des cotisations et utilisateurs n’ajoutent pas de marge verticale propre dans leur en-tête. L’actualisation de l’accueil est un bouton icône de même hauteur et rayon, contigu au choix de budget, avec libellé accessible et infobulle. Ces contrôles emploient les mêmes couleurs sémantiques dans Bassin clair et Graphite.

Les onglets des budgets, d’E-mails et des membres partagent la présentation d’E-mails : fond surface, coins supérieurs de la barre arrondis à 12px et coins inférieurs droits. La règle commune cible `[mat-tab-nav-bar]` et l’en-tête direct de `mat-tab-group`. Les onglets sont contigus à leur contenu : aucune marge inférieure sur leur navigation, aucune marge supérieure ajoutée à la carte des membres. Sous `mat-tab-group` et `mat-tab-nav-panel`, `--asl-table-radius` vaut `0` : les tableaux n’ont aucun coin arrondi, en haut comme en bas. Les listes sans onglets conservent leurs quatre coins arrondis.

Dans un budget, l’onglet Carte prolonge le fond `surface` de la barre dans un panneau à angles droits, avec bordure fine et padding de 1rem. Ce panneau réunit légende et carte en lecture seule : aucun survol actif, pointeur de bouton, sélection ni réaction au clic ou au clavier. La figure SVG conserve son fond géographique clair, ses numéros et ses couleurs métier dans les deux thèmes.

La carte des membres et le détail associé partagent aussi un seul panneau `surface`, bordé et sans arrondi, raccordé aux onglets. Un séparateur vertical distingue les coordonnées sur grand écran ; il devient horizontal lorsque les colonnes s’empilent. Les anciennes cartes arrondies et le bandeau d’instruction/actualisation sont supprimés. L’actualisation habituelle reste dans l’annuaire et des boutons de reprise apparaissent sur la carte en cas d’erreur ; effacer la sélection rend le focus au titre du détail. La figure SVG est droite dans cette vue et conserve son fond géographique clair.

Lorsqu’un lot est sélectionné, chaque copropriétaire garde ses coordonnées mais la section « Lots associés » et l’action « Voir tous ses lots » apparaissent seulement pour les membres possédant plusieurs lots. La consultation directe d’un membre conserve sa liste de lots et le message d’absence de lot.

### Navigation

Le menu Repères est horizontal sur grand écran. Les liens ont un padding de 10px par 12px, un rayon de navigation et un texte de 0.875rem. La page active change de fond et d’encre, prend une graisse de 650 et porte `aria-current="page"`. Le survol ajoute un mélange de l’encre à 12 %. Le contour de focus est intérieur, avec l’encre du bandeau au repos et l’encre de navigation sur la page active. Le lien d’évitement devient visible au focus ; le tiroir mobile conserve l’indication de page active.

Le sélecteur de thème offre Clair · Bassin clair, Sombre · Graphite et Suivre le système, avec des entrées radio nommées. ThemeService conserve la préférence sous `asl-theme`, suit les changements du système et reste utilisable si le stockage est indisponible.

### Lists / Data states

Le tableau CRUD est bordé, avec en-têtes `raised`, texte secondaire et séparations fines. Le survol des lignes emploie `tint`. Le chargement, l’absence de données, l’absence de résultat et l’erreur ont des textes distincts ; les erreurs permettent de réessayer, une recherche vide permet de l’effacer. Les zones de statut utilisent `role="status"`, les erreurs `role="alert"`. Une table distante en rechargement devient inerte sous son indicateur de progression.

### Carte interactive

Le SVG existant garde son fond clair, ses numéros et ses cinq remplissages financiers. Un résultat de recherche reçoit un contour de 2px ; le lot sélectionné, 4px ; le lot au focus, 4px en tirets `5 3`. Les contours ne changent pas d’épaisseur avec l’échelle du dessin. Un seul lot entre dans l’ordre de tabulation ; les flèches, Début et Fin déplacent le focus, Entrée et Espace activent le lot.

Ces interactions sont conservées pour le dashboard et les membres. Le composant partagé accepte `interactive=false` pour la vue Carte d’un budget : SVG exposé comme image nommée, aucun lot présenté comme bouton ni accessible par Tab, aucune émission d’action ou contour de sélection. Le mode interactif reste le comportement par défaut.

Les transitions durent 140ms pour les contours et 180ms pour l’ombre du détail, avec `ease-out`. Elles sont supprimées lorsque la réduction du mouvement est demandée. Le sidecar montre seulement un fragment d’état, pas une carte de remplacement ni des données réelles.

## Do's and Don'ts

### Do:

- **Do** utiliser les variables sémantiques `--asl-*` pour que les deux thèmes restent cohérents.
- **Do** garder la légende financière, les libellés d’état et le contour de sélection indépendants.
- **Do** conserver les chiffres tabulaires, les libellés accessibles et les états de chargement, vide et erreur distincts.
- **Do** vérifier le focus sur le bandeau, les menus et la carte dans les deux thèmes, puis le rendu sur ordinateur et mobile.

### Don't:

- **Don't** réutiliser le violet de trop-perçu comme couleur de sélection de la carte.
- **Don't** assombrir le fond géographique de la carte sans revoir ses routes et ses numéros.
- **Don't** remplacer le bouton + compact des listes par une action sans nom accessible ni infobulle.
- **Don't** présenter une extraction de code, un build ou une vignette du sidecar comme une validation visuelle de l’application.
