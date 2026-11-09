---
version: 1
slug: "core-components-page-page-component-html-8119eab6"
primary_target: "frontend/src/app/core/components/page/page.component.html"
related_targets: ["frontend/src/styles.scss","frontend/src/app/dashboard/dashboard.component.html","frontend/src/app/shared/components/crud-table/crud-table.component.html"]
---

# Refonte de l’application de gestion

Mode : Operate. Web responsive ; navigation, tableau de bord et composants partagés. Conserver les fonctions, les droits, les données et la carte SVG. La recherche des paiements depuis la carte est prioritaire.

## Direction contract

THESIS: Lire les paiements et agir depuis la carte dans une application claire, accueillante et précise. Remplacer la barre et le rail Material 2 par une navigation supérieure, un espace de travail structuré et des contrôles Material 3.

OWN-WORLD: Choix explicite de Thomas : Bassin clair (cobalt, bleu eau, blanc), variante Graphite sombre, menu supérieur de Repères. Sans UI lisible, chiffres tabulaires, surfaces unies, séparations fines. Les états financiers gardent leurs couleurs ; le violet reste le trop-perçu.

STORY: Choisir un budget, lire sa situation, rechercher un membre ou un lot sur la carte et consulter son détail. Les explications financières restent accessibles. Les autres modules partagent les mêmes composants.

FIRST VIEWPORT: Navigation horizontale au sommet, compte et sélecteur de thème à droite ; titre et budget, puis quatre indicateurs. Carte et recherche à gauche, détail sélectionné à droite sur grand écran ; empilement sur mobile. Signature : recherche, contour du lot et fiche répondent ensemble, sans recouvrir sa couleur de paiement. Transition de sélection courte, contenu toujours visible ; réduction du mouvement respectée.

FORM: Direction 3, Bassin clair, avec adaptations expressément demandées Graphite et navigation Repères. seed:9aa276412dc2e90c. Construction code-led ; les aperçus publiés servent de référence de composition, sans données fictives dans l’application.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Vérification

Tests Angular et helpers, build de production, cohérence des thèmes et conservation de la navigation mobile, des droits et des états métier. Cet environnement interdit le navigateur local et un serveur de présentation supplémentaire : pas de prétendue inspection visuelle par capture. Revue indépendante du code à portée explicite, puis validation humaine du rendu local. Aucun raster nouveau prévu.

État de livraison : 128 tests Angular et 20 helpers réussis ; build de production réussi. Scan statique Impeccable sans constat. Revue indépendante des sources : contrastes de focus et variantes M3 warn/accent corrigés puis déclarés résolus. DESIGN.md et sidecar documentent le code livré. Verdict visuel `recapture` encore ouvert : captures desktop/mobile indisponibles par contrainte d’environnement. La fiche de 16 tests publiée accompagne la validation humaine ; aucun verdict visuel `ship` n’est revendiqué.
