# Fiche de validation — ASL Bissieux

Version fonctionnelle de référence : `aee184c` sur `dev` — fiche du 21 octobre 2026.

Validateur : ____________________ · Date : ____________________ · Navigateur / appareil : ____________________

Cocher uniquement après avoir exécuté l’action et constaté le résultat attendu. Une case vide ne signifie pas un échec : noter « À faire », « Échec », « Bloqué » ou « Sans objet », avec l’identifiant du test et une explication. Les validations des anciens lots et les tests automatisés ne précochent pas cette nouvelle recette.

La version HTML propose les mêmes tests, des notes par test, une progression, un export/import JSON et une impression. La sauvegarde dans le navigateur dépend de son autorisation de stockage ; exporter les résultats avant de quitter ou de changer d’appareil. Aucun résultat n’est envoyé automatiquement à l’agent.

## Préparer la séance

Lots : prérequis communs à tous les parcours.

- [ ] **P01 — Identifier l’environnement de validation**
  Action : Ouvrir l’application locale habituelle et relever le navigateur, la date et la version dans les informations de séance.
  Attendu : Le test concerne le développement local ; la connexion Google est conservée, le SMTP est simulé et les appels OVH passent par Smocker.

- [ ] **P02 — Préparer des données reconnaissables**
  Action : Réserver des membres, budgets, modèles et campagnes fictifs préfixés « TEST recette » ; utiliser des adresses example.invalid. Noter les identifiants utilisés.
  Attendu : Les modifications de la recette concernent seulement ces données ; les fiches et écritures historiques sont conservées. Ne pas réinitialiser la base ni rejouer les seeds.

- [ ] **P03 — Prévoir les variantes nécessaires**
  Action : Identifier un compte administrateur, un second compte si disponible, un membre multi-lots, un lot avec copropriétaires et un lot représenté sur la carte. Noter les cas absents.
  Attendu : Les variantes sans prérequis restent « Bloqué » ou « Sans objet » avec une raison ; elles ne sont pas comptées comme validées.

## Listes OVH avec Smocker et Viper

Lots : lot actuel OVH, simulation de développement et configuration Viper.
Préparation : compte administrateur ; membres de test avec adresses valides ; aucun identifiant OVH réel nécessaire. La synchronisation prend en compte tous les membres actifs de l’annuaire, pas seulement ceux préfixés TEST. Vérifier l’aperçu complet avant application.

- [ ] **OVH01 — Afficher les deux listes simulées**
  Action : Ouvrir « Listes de diffusion », puis actualiser l’aperçu.
  Attendu : La connexion est configurée sur example.invalid ; les listes membres et bureau et leurs écarts s’affichent. L’état initial du simulateur contient ancien-membre@example.invalid et ancien-bureau@example.invalid, sauf si une validation a déjà été appliquée.

- [ ] **OVH02 — Affecter explicitement le rôle Bureau**
  Action : Cocher « Membre du bureau » sur une fiche de test avec e-mail, enregistrer, rouvrir la fiche puis actualiser l’aperçu des listes.
  Attendu : La case reste cochée ; l’adresse est attendue dans Membres et Bureau. Aucun droit administrateur n’est accordé à cette personne.

- [ ] **OVH03 — Dédupliquer les adresses**
  Action : Utiliser un membre multi-lots et, si possible, deux fiches de test partageant la même adresse avec une casse différente ; actualiser l’aperçu.
  Attendu : Une adresse normalisée ne figure qu’une fois par liste. Elle figure dans Bureau si au moins une fiche portant cette adresse est cochée Bureau.

- [ ] **OVH04 — Bloquer une source incomplète**
  Action : Sur une fiche de test, laisser l’e-mail vide, enregistrer puis actualiser les listes. Renseigner ensuite une adresse valide et recommencer.
  Attendu : La fiche à corriger est nommée ; l’application des écarts est bloquée tant que l’adresse manque, puis redevient possible après correction si des écarts existent. Les listes ne sont pas vidées automatiquement.

- [ ] **OVH05 — Relire et annuler une confirmation**
  Action : Demander l’application, vérifier les ajouts et retraits des deux listes, puis annuler la confirmation.
  Attendu : La confirmation décrit les changements, y compris une éventuelle liste vide. L’annulation n’applique aucune modification.

- [ ] **OVH06 — Appliquer et vérifier après traitement**
  Action : Confirmer un aperçu récent ; attendre au moins une seconde puis actualiser.
  Attendu : Les demandes sont acceptées ; un succès vérifié n’est annoncé qu’après relecture des deux listes sans tâches en attente. Les anciennes adresses fictives absentes de l’annuaire sont retirées et les adresses attendues ajoutées.

- [ ] **OVH07 — Éviter une réapplication inutile**
  Action : Actualiser encore après la réussite du test précédent et essayer de relancer sans modifier les membres.
  Attendu : Aucun ajout ou retrait ne subsiste ; aucune nouvelle synchronisation n’est applicable. Si le traitement a été très rapide, l’état intermédiaire « en attente » peut ne pas avoir été visible.

- [ ] **OVH08 — Répercuter un changement d’e-mail et de rôle**
  Action : Modifier l’adresse d’une fiche de test synchronisée, décocher son rôle Bureau, enregistrer puis appliquer un nouvel aperçu.
  Attendu : L’ancienne adresse est retirée si aucune autre fiche active ne la porte ; la nouvelle reste dans Membres. Bureau suit les cases des fiches actives, indépendamment des droits de connexion.

- [ ] **OVH09 — Refuser un aperçu devenu périmé**
  Action : Charger un aperçu avec des écarts ; dans un second onglet modifier une fiche concernée, puis tenter d’appliquer le premier aperçu.
  Attendu : L’ancien aperçu est refusé avec invitation à actualiser ; les écarts obsolètes ne sont pas appliqués.

- [ ] **OVH10 — Réserver la synchronisation aux administrateurs**
  Action : Avec un compte actif non administrateur, chercher le menu des listes puis tenter d’ouvrir directement la route /#/mailing-lists.
  Attendu : La gestion des listes est inaccessible. L’appartenance au bureau ne suffit pas à donner cet accès. Sans second compte, noter le test comme bloqué.

## Tableau de bord et derniers correctifs

Lots : lot 18, liens du dashboard et sélection du dernier budget.

Préparation : depuis le 22 octobre 2026, le suivi mensuel a été retiré à la demande de Thomas. Le cas historique DB07 est sans objet ; les nouveaux contrôles sont décrits dans la fiche de refonte, section « Ajustements après la première revue ».

- [ ] **DB01 — Sélectionner le dernier budget par défaut**
  Action : Créer deux budgets fictifs à la suite, dont le dernier reste brouillon ; ouvrir /#/dashboard sans paramètres budget.
  Attendu : Le budget créé le plus récemment est sélectionné, même brouillon. Le choix ne dépend pas du nom ou de l’année inscrite dans le libellé.

- [ ] **DB02 — Conserver les choix explicites**
  Action : Choisir un ancien budget, ouvrir la comparaison pour choisir une référence et éventuellement sélectionner un lot ; recharger puis utiliser précédent/suivant du navigateur.
  Attendu : L’URL conserve les choix et l’écran les restitue ; le budget récent ne remplace pas une sélection explicite. L’exercice et la référence ne sont pas déduits du budget.

- [ ] **DB03 — Respecter un choix vide ou introuvable**
  Action : Ouvrir /#/dashboard?budget= ; puis essayer un identifiant budget inexistant dans l’URL.
  Attendu : Le choix vide reste vide. Un budget inexistant provoque un état explicite, sans sélection silencieuse d’un autre budget.

- [ ] **DB04 — Vérifier les couleurs des liens**
  Action : Cliquer plusieurs liens du dashboard, revenir sur la page et les parcourir avec Tab ; répéter dans les thèmes clair et sombre si disponibles.
  Attendu : Les liens gardent la couleur de texte du thème avant et après visite, avec soulignement et focus visibles ; aucun bleu ou violet de lien navigateur parasite.

- [ ] **DB05 — Retrouver les bons filtres depuis les indicateurs**
  Action : Ouvrir un indicateur de recouvrement, de qualité d’annuaire puis un état d’e-mails.
  Attendu : Les indicateurs financiers ouvrent les cotisations avec le filtre correspondant. Depuis la revue du 22 octobre, les liens annuaire et campagnes ouvrent les listes complètes, sans filtre de qualité ni d’état ; le filtre d’état reste disponible à l’intérieur d’une campagne.

- [ ] **DB06 — Séparer reste à encaisser et trop-perçus**
  Action : Sur un budget fictif publié, comparer les appels et règlements par lot avec les indicateurs, en incluant un lot débiteur et un lot en trop-perçu.
  Attendu : Un excédent ne compense pas la dette d’un autre lot. Exemple si deux lots appellent 100 € chacun et ont reçu 120 € et 0 € : reste 100 €, trop-perçu 20 €, recouvrement 50 %.

- [ ] **DB07 — Comparer graphique et tableau mensuels**
  Action : Classer ce cas historique « Sans objet ». Le graphique, le sélecteur d’année et le tableau mensuels ont été retirés à la demande de Thomas le 22 octobre 2026.
  Attendu : Aucun contrôle du suivi mensuel n’est requis. Vérifier le dashboard allégé avec le cas AJUST4 de la fiche de refonte ; conserver les anciens résultats à titre historique.

- [ ] **DB08 — Consulter la carte et la comparaison de budgets**
  Action : Sélectionner un lot sur la carte du dashboard ; puis choisir un brouillon, ouvrir « Comparer les budgets annuels » et sélectionner une référence.
  Attendu : La légende distingue les états et les détails concernent le lot sélectionné. Le brouillon affiche son aperçu ; la comparaison indique l’écart de dépenses initiales sans inventer un ancien taux par part.

## Connexion Google et sessions

Lots : lot 8 et finitions du lot 9.

- [ ] **AUTH01 — Se connecter avec Google**
  Action : Se déconnecter, lancer « Se connecter » et utiliser le compte Google déjà autorisé.
  Attendu : La connexion revient dans l’application avec le bon compte et les mêmes droits, sans erreur redirect_uri_mismatch.

- [ ] **AUTH02 — Conserver la session et la destination**
  Action : Ouvrir un détail de budget, recharger la page, puis ouvrir cette route dans un autre onglet.
  Attendu : La session reste utilisable ; la route demandée s’affiche sans boucle de connexion ni perte de contexte injustifiée.

- [ ] **AUTH03 — Fermer la session applicative**
  Action : Utiliser « Se déconnecter », puis revenir sur une route privée et se reconnecter.
  Attendu : Les données privées ne restent pas accessibles après déconnexion ; la reconnexion retrouve le compte. La déconnexion de l’application ne déconnecte pas nécessairement le compte Google du navigateur.

- [ ] **AUTH04 — Afficher un refus ou une attente clairement**
  Action : Si un second compte de test est disponible, se connecter avec un compte en attente ou désactivé, puis utiliser « Actualiser mon accès » après décision administrative.
  Attendu : L’écran explique l’état du compte et ne donne pas accès aux données métier ; une décision récente est prise en compte sans créer un nouveau compte.

## Navigation, formulaires et affichage

Lots : lots 9–10, modernisation 6–7 et finitions transverses.

- [ ] **UI01 — Naviguer sur mobile**
  Action : Utiliser une largeur mobile, ouvrir le menu, choisir une page puis rouvrir et fermer le menu au clavier.
  Attendu : Le menu se replie après navigation ; la page reste utilisable et aucun fond de menu ne bloque le contenu.

- [ ] **UI02 — Vérifier le clavier et les dialogues**
  Action : Parcourir une liste avec Tab, ouvrir une action, annuler puis confirmer une autre opération sur une donnée fictive.
  Attendu : Le focus est visible, reste dans la fenêtre ouverte puis revient à un contrôle pertinent. Les actions possèdent un nom compréhensible.

- [ ] **UI03 — Vérifier les boutons d’ajout et les libellés**
  Action : Consulter Membres, Lots, Budgets, Modèles et Campagnes ; survoler ou focaliser le bouton +.
  Attendu : Le + reste compact et coloré, sans texte visible ajouté à côté ; son infobulle ou nom accessible précise l’action. Les libellés métier et confirmations sont en français.

- [ ] **UI04 — Distinguer vide, filtre vide et erreur**
  Action : Faire une recherche sans résultat puis effacer le filtre ; consulter une liste vide si disponible. Faire vérifier un scénario de chargement en erreur si nécessaire.
  Attendu : Les messages distinguent absence de données, aucun résultat et erreur ; l’effacement ou la relance permet de reprendre sans perdre les critères utiles.

- [ ] **UI05 — Éviter les doubles enregistrements**
  Action : Sur une création fictive, cliquer rapidement deux fois sur Enregistrer ; contrôler ensuite la liste.
  Attendu : Une seule création a lieu ; les actions sont protégées pendant l’enregistrement. En cas d’erreur, la saisie reste disponible pour correction.

- [ ] **UI06 — Vérifier confort visuel et zoom**
  Action : Tester les pages principales à une largeur d’environ 375 px, puis avec un zoom de 200 % sur ordinateur ; essayer les thèmes disponibles.
  Attendu : Textes, erreurs et actions restent lisibles ; seuls les tableaux larges défilent horizontalement, pas toute la page. Les couleurs ne sont pas le seul moyen de comprendre un état.

## Annuaire, lots et carte

Lots : lot 13 et correction d’alignement demandée.

- [ ] **DIR01 — Rechercher avec accents et casse**
  Action : Rechercher un membre de test portant un accent avec et sans accent, en majuscules puis en minuscules ; essayer son adresse ou son téléphone.
  Attendu : La recherche retrouve le même membre et le compteur correspond aux résultats ; des coordonnées absentes n’affichent pas une valeur technique.

- [ ] **DIR02 — Conserver la recherche entre Annuaire et Carte**
  Action : Ouvrir la loupe de l’annuaire, saisir une recherche, passer à l’onglet Carte puis revenir à Annuaire.
  Attendu : La recherche est réservée au tableau et reste mémorisée au retour. La carte permet de cliquer sur tous les lots, sans recherche ni listes de sélection. Les deux onglets restent lisibles sur mobile.

- [ ] **DIR03 — Consulter multi-lots et copropriétaires**
  Action : Choisir un membre multi-lots, puis un lot ayant plusieurs membres associés.
  Attendu : Tous les lots du membre et tous les membres du lot sont accessibles, sans confusion entre copropriétaire et doublon.

- [ ] **DIR04 — Rechercher directement un lot**
  Action : Dans l’annuaire, rechercher « lot N » pour retrouver ses membres. Dans l’onglet Carte, cliquer sur un lot sans membre si le cas existe.
  Attendu : L’annuaire retrouve les membres associés au numéro recherché ; la carte indique explicitement l’absence de membre pour un lot sans association.

- [ ] **DIR05 — Utiliser la carte au clavier**
  Action : Entrer dans la carte avec Tab, se déplacer avec les flèches, sélectionner avec Entrée ou Espace.
  Attendu : Le lot sélectionné et ses informations sont identifiables sans souris ; la sélection ne dépend pas de la couleur seule.

- [ ] **DIR06 — Passer d’un budget à l’annuaire du lot**
  Action : Classer ce cas historique « Sans objet » : depuis la revue du 24 octobre, la carte d’un budget est uniquement consultative et ne sélectionne plus de lot.
  Attendu : Aucune action n’est attendue au clic dans cette carte. Vérifier AJUST8 dans la fiche de refonte ; les cartes du dashboard et des membres restent interactives.

## Budgets brouillons, publication et centimes

Lots : lots 4–5 ; base de la recette financière.
Préparation : nouveau budget fictif « TEST recette finances ». Ne pas modifier un budget historique pour fabriquer les cas.

- [ ] **BUD01 — Consulter l’aperçu avant publication**
  Action : Créer le brouillon, ajouter une dépense et relever total du budget, total des parts, annuel par part et mensuel par part.
  Attendu : L’aperçu reste brouillon, utilise douze mois et ne crée aucune cotisation ni aucun paiement. Les taux indicatifs ont leur règle d’arrondi affichée.

- [ ] **BUD02 — Actualiser les calculs du brouillon**
  Action : Ajouter, modifier puis supprimer une dépense fictive ; utiliser Actualiser après un changement de parts réalisé uniquement sur des lots de test.
  Attendu : Les totaux et taux sont recalculés. Le total annuel divisé par les parts donne l’annuel par part ; le mensuel est divisé par douze.

- [ ] **BUD03 — Vérifier les centimes sans approximation**
  Action : Sur un brouillon dédié, saisir des dépenses de 0,10 € et 0,20 € et consulter le total.
  Attendu : Le total est exactement 0,30 €. Une saisie monétaire à plus de deux décimales n’est pas acceptée silencieusement comme un autre montant.

- [ ] **BUD04 — Publier une seule fois**
  Action : Publier le budget de recette, puis réactualiser et vérifier ses cotisations.
  Attendu : Le budget passe à publié ; une seule cotisation par lot est créée et leur somme correspond exactement au budget. Réessayer ne duplique pas les appels.

- [ ] **BUD05 — Conserver les dépenses et appels initiaux**
  Action : Sur le budget publié, chercher les modifications de dépenses ou de montants initiaux.
  Attendu : Ces données sont verrouillées ; les corrections passent par un ajustement tracé, y compris pour un administrateur.

- [ ] **BUD06 — Annuler sans effet**
  Action : Ouvrir une création de budget ou une dépense de test, modifier la saisie puis annuler.
  Attendu : Aucun objet ou montant supplémentaire n’est créé ; les données enregistrées auparavant restent inchangées.

## Paiements et états des cotisations

Lots : lot 1 et calculs du lot 5.
Préparation : budget de recette publié ; choisir un lot avec un appel strictement positif et aucun paiement. Appeler C le montant de cet appel et le noter.

- [ ] **PAY01 — Enregistrer et retrouver un paiement**
  Action : Dans l’historique de la cotisation, ajouter un paiement fictif avec commentaire, date et montant positif ; fermer puis rouvrir.
  Attendu : Les champs et la date métier sont conservés ; le réglé et le solde reflètent le paiement.

- [ ] **PAY02 — Modifier réellement un paiement**
  Action : Modifier ce paiement avec un nouveau commentaire, une autre date et un autre montant, puis recharger.
  Attendu : La même ligne est modifiée et ses nouvelles valeurs persistent ; une ligne supplémentaire n’est pas créée.

- [ ] **PAY03 — Vérifier les états aux seuils**
  Action : Sur ce lot de recette, faire successivement correspondre le total des paiements à 25 % de C, 75 % de C, C puis C + 50 €, avec des montants arrondis au centime.
  Attendu : Tableau et carte reflètent les mêmes situations : moins de moitié, au moins moitié non soldé, soldé puis trop-perçu de 50 €. Les montants priment si un seuil exact n’est pas représentable au centime.

- [ ] **PAY04 — Refuser les montants invalides**
  Action : Essayer un montant nul, négatif puis à trois décimales, sans valider une autre écriture.
  Attendu : Chaque saisie invalide est signalée ou l’enregistrement reste indisponible ; aucun paiement invalide n’est créé.

- [ ] **PAY05 — Supprimer un paiement fictif**
  Action : Sur un second paiement de test sans remboursement associé, demander sa suppression, annuler puis recommencer et confirmer.
  Attendu : Annuler conserve la ligne ; confirmer la retire des calculs actifs et recalcule les soldes et états.

## Remboursements, ajustements et historique

Lots : lot 16.
Préparation : compte autorisé ; utiliser le lot de PAY03, avec un appel C et des paiements C + 50 €. Les opérations enregistrent un mouvement fictif déjà effectué ; aucun virement bancaire n’est lancé.

- [ ] **FIN01 — Prévisualiser un remboursement partiel**
  Action : Dans l’historique, préparer un remboursement de 20 € avec date et motif ; lire l’aperçu puis annuler.
  Attendu : L’aperçu montre un trop-perçu passant de 50 € à 30 € ; annuler ne crée aucune écriture.

- [ ] **FIN02 — Enregistrer des remboursements partiel puis complet**
  Action : Enregistrer 20 € puis 30 € de remboursements fictifs.
  Attendu : Le trop-perçu passe de 50 € à 30 €, puis à zéro ; le lot est soldé. L’historique conserve montants, dates, motifs et auteurs.

- [ ] **FIN03 — Refuser un dépassement**
  Action : Une fois le lot soldé, essayer d’enregistrer un remboursement supplémentaire de 0,01 €.
  Attendu : Le dépassement est refusé ; aucun montant n’est remboursé au-delà du trop-perçu disponible.

- [ ] **FIN04 — Annuler par contre-écriture**
  Action : Annuler le remboursement de 20 € enregistré dans FIN02, en indiquant le motif.
  Attendu : L’original reste visible et une contre-écriture liée apparaît ; le trop-perçu redevient 20 €. Une seconde annulation de l’original et l’annulation de la contre-écriture sont interdites.

- [ ] **FIN05 — Ajuster l’appelé sans réécrire le budget**
  Action : Prévisualiser puis enregistrer un supplément de 10 €, puis une réduction de 5 € sur cette cotisation.
  Attendu : Le trop-perçu passe de 20 € à 10 €, puis à 15 €. Le total appelé effectif change, les dépenses initiales restent identiques, et chaque ajustement est tracé. Un appelé effectif négatif est interdit.

- [ ] **FIN06 — Protéger la cohérence des remboursements**
  Action : Essayer de réduire ou supprimer les paiements fictifs sous le montant net des remboursements déjà enregistrés.
  Attendu : L’opération incohérente est refusée avec une explication ; l’historique ne disparaît pas. Corriger les écritures de test uniquement par les opérations prévues.

## Modèles, variables et aperçu des e-mails

Lots : lot 12 et champs supplémentaires guidés.

- [ ] **TPL01 — Insérer une variable à la bonne place**
  Action : Créer un modèle « TEST recette », placer le curseur ou sélectionner du texte dans l’objet puis le corps et utiliser « Insérer une variable ».
  Attendu : L’expression remplace la sélection ou s’insère au curseur du bon champ ; le focus revient à cet emplacement. Un ancien modèle ouvert n’est pas réécrit automatiquement.

- [ ] **TPL02 — Insérer une liste de lots ou de dépenses**
  Action : Insérer depuis le catalogue un bloc de cotisations ou de dépenses dans le corps puis tester le modèle enregistré.
  Attendu : Le bloc répété est complet et se rend avec les données d’exemple ; une propriété de lot n’est pas présentée comme une propriété globale.

- [ ] **TPL03 — Déduire un champ supplémentaire**
  Action : Ajouter {{.date_limite}} au modèle, enregistrer puis ouvrir son aperçu ou la préparation depuis un budget.
  Attendu : Un champ Date limite est proposé ; une valeur manquante bloque l’aperçu jusqu’à saisie ou choix explicite d’une valeur vide. La valeur saisie remplace l’expression dans le rendu.

- [ ] **TPL04 — Conserver les données avancées**
  Action : Saisir une valeur supplémentaire numérique, une valeur Oui/non et une structure JSON ; basculer entre mode guidé et mode avancé.
  Attendu : Types, objets et listes sont conservés. Une donnée invalide ou un nom dupliqué est expliqué ; une saisie incomplète n’est pas perdue silencieusement.

- [ ] **TPL05 — Utiliser un aperçu sans créer de campagne**
  Action : Depuis la liste des modèles, prévisualiser la version enregistrée avec l’exemple fictif, puis des données personnalisées ; modifier ces données après le rendu.
  Attendu : Aucune campagne n’est créée ; les membres réels ne sont pas utilisés dans cet aperçu générique. Le résultat devient périmé après modification et doit être recalculé.

- [ ] **TPL06 — Signaler une erreur de rendu**
  Action : Tester un modèle fictif référençant une donnée absente ou une expression volontairement incorrecte, puis corriger.
  Attendu : L’erreur est explicite, le rendu incorrect n’est pas présenté comme valide et la saisie reste disponible pour reprendre.

## Préparation des campagnes depuis un budget

Lots : lots 2, 11–12.
Préparation : modèle de test, budget publié et membres fictifs ; les situations de paiement peuvent être réparties sur plusieurs lots disponibles. Ne pas modifier des paiements historiques pour créer un cas manquant.

- [ ] **PREP01 — Vérifier les destinataires retenus**
  Action : Ouvrir « Préparer les e-mails », essayer les options ajoutant les cotisations réglées au moins à moitié puis celles soldées ou en trop-perçu.
  Attendu : Les destinataires et cotisations inclus changent selon les critères ; les fiches sans adresse sont exclues. La règle de base retient celles réglées à moins de la moitié.

- [ ] **PREP02 — Prévisualiser exactement la sélection**
  Action : Choisir un destinataire, afficher l’aperçu puis changer un critère ou une valeur supplémentaire.
  Attendu : L’aperçu correspond au destinataire et aux cotisations retenues ; après changement il est marqué périmé ou recalculé, sans conserver un ancien résultat comme actuel.

- [ ] **PREP03 — Grouper par membre**
  Action : Inclure un membre multi-lots et les copropriétaires d’un lot puis préparer une campagne de test.
  Attendu : Chaque identifiant de membre reçoit un message regroupant ses cotisations incluses ; les copropriétaires restent distincts, même si deux fiches partagent une adresse. Ce regroupement diffère de la déduplication des adresses des listes OVH.

- [ ] **PREP04 — Séparer préparation et envoi**
  Action : Confirmer la création de la campagne puis consulter son historique avant d’utiliser Envoyer.
  Attendu : La campagne et ses messages sont créés en attente ; préparer ne transmet aucun message au SMTP.

- [ ] **PREP05 — Vérifier tous les destinataires avant création**
  Action : Avec un modèle de test dépendant d’une donnée absente chez un destinataire retenu, lancer la préparation.
  Attendu : Le problème de rendu bloque toute la création ; aucune campagne partielle ne subsiste. Si ce jeu de données n’est pas disponible, noter le besoin de préparation technique.

## Pagination et recherche des campagnes

Lots : lot 14.
Préparation : assez de campagnes fictives pour obtenir plusieurs pages ; sinon noter les cas de pagination comme bloqués, sans générer des envois.

- [ ] **CAMP01 — Naviguer sans doublons**
  Action : Parcourir plusieurs pages, changer la taille de page puis revenir à la première.
  Attendu : Le total est cohérent, les pages ne doublonnent pas ; changer la taille revient à la première page. Le libellé de pagination reste lisible sur mobile.

- [ ] **CAMP02 — Rechercher dans toutes les pages**
  Action : Chercher le titre d’une campagne qui n’est pas sur la première page, avec une casse différente ; essayer un titre contenant un caractère % ou _ si disponible.
  Attendu : La recherche porte sur l’ensemble des campagnes ; les caractères spéciaux de recherche sont traités littéralement, pas comme des jokers.

- [ ] **CAMP03 — Trier et changer rapidement de filtre**
  Action : Trier par titre ou date, puis saisir rapidement deux recherches successives.
  Attendu : Le tri concerne toutes les pages ; une ancienne réponse ne remplace pas la recherche la plus récente.

- [ ] **CAMP04 — Vérifier les compteurs d’envoi**
  Action : Comparer une campagne avec les états visibles de ses messages et, si possible, supprimer une campagne fictive située sur la dernière page.
  Attendu : Envoyés et signaux d’ouverture ne sont pas comptés deux fois ; la navigation revient à une page existante après suppression du dernier résultat.

## Historique des messages et envoi simulé

Lots : lot 2 et lot 15.
Préparation : SMTP local simulé et campagne TEST ; ne pas utiliser de campagne réelle ni modifier la configuration SMTP pour cette recette courante.

- [ ] **MAIL01 — Filtrer par destinataire et état**
  Action : Dans une campagne, rechercher un destinataire et choisir un état ; changer de page et de taille.
  Attendu : Les filtres s’appliquent à tous les messages de la campagne. La recherche porte sur le destinataire, pas sur le corps ou l’objet du message.

- [ ] **MAIL02 — Limiter la sélection à la page**
  Action : Sélectionner des messages puis changer la page ou le filtre.
  Attendu : La sélection est effacée immédiatement ; les anciennes lignes ne restent pas actionnables pendant le chargement et aucune action groupée ne cible une autre page.

- [ ] **MAIL03 — Consulter un message à la demande**
  Action : Ouvrir l’aperçu d’un message long puis le parcourir au clavier ; changer de campagne pendant un autre chargement d’aperçu si possible.
  Attendu : La fenêtre reste dans l’écran et son contenu peut défiler au clavier ; un message d’une ancienne campagne n’apparaît pas dans la nouvelle.

- [ ] **MAIL04 — Envoyer une fois vers le SMTP simulé**
  Action : Envoyer des messages TEST en attente, surveiller la progression puis actualiser et essayer de relancer les mêmes messages.
  Attendu : Les statuts reflètent les réponses effectives du SMTP simulé ; les messages envoyés ne sont pas renvoyés automatiquement et la progression ne reste pas bloquée.

- [ ] **MAIL05 — Comprendre les états et restrictions**
  Action : Consulter les états disponibles, notamment envoi en cours, erreur ou résultat à vérifier lorsque ces cas existent.
  Attendu : Un envoi en cours ne peut être supprimé ou relancé ; un résultat incertain n’est pas renvoyé automatiquement. « Signal d’ouverture » ne prétend pas prouver une lecture humaine.

## Comptes, autorisations et demandes d’accès

Lots : lot 17 et protections d’authentification.
Préparation : second compte de test et administrateur opérationnel. Ne jamais désactiver ou retirer les droits de son seul compte administrateur pour fabriquer un cas.

- [ ] **ACC01 — Distinguer droits et activation**
  Action : Sur une demande de test en attente, modifier les droits sans décider son activation, puis actualiser l’accès du compte concerné.
  Attendu : La demande reste en attente. L’activation est une décision séparée et explicite.

- [ ] **ACC02 — Activer, désactiver et réactiver**
  Action : Activer une demande de test ; dans une autre session constater l’accès, puis désactiver ce compte et enfin le réactiver.
  Attendu : Chaque décision est confirmée sur le bon compte ; la désactivation retire l’accès et la réactivation le rétablit avec les droits définis, sans recréer l’identité.

- [ ] **ACC03 — Refuser une demande sans la supprimer**
  Action : Refuser une autre demande de test puis consulter le filtre des comptes et l’accès du compte concerné.
  Attendu : La demande ne compte plus parmi les demandes en attente ; le compte reste conservé et voit une explication de refus.

- [ ] **ACC04 — Respecter la confidentialité et les droits**
  Action : Avec un compte actif non administrateur, consulter le dashboard et tenter d’accéder à Comptes et accès.
  Attendu : Ni les demandes en attente ni les identités d’autres comptes ne sont exposées ; les modifications non autorisées restent inaccessibles. Cocher Bureau dans l’annuaire ne change pas ces droits.

## Vérifications avec préparation technique

Lots : migrations 3, modernisation 6–7, limites et reprises transverses ; complément au lot OVH/Viper.
Préparation : intervention opérateur et données isolées. Ces tests ne sont pas exigés dans le parcours courant si leurs prérequis manquent ; indiquer la raison. Ils ne demandent aucune bascule de production.

- [ ] **TECH01 — Vérifier Viper et les variables OVH**
  Action : Faire contrôler sur un environnement de test les valeurs ml.domain, ml.members, ml.bureau depuis YAML, puis APP_ML_DOMAIN, APP_ML_MEMBERS, APP_ML_BUREAU et les options --ml-*.
  Attendu : Viper respecte options de commande > environnement > YAML. Le client utilise OVH_ENDPOINT, OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY ; aucune configuration ConfigStore ni variable APP_ML de secret n’est nécessaire. Ne noter aucune valeur secrète dans cette fiche.

- [ ] **TECH02 — Tester absence et invalidité de configuration OVH**
  Action : Sur une instance séparée, retirer toute configuration des listes ; tester ensuite une configuration partielle et deux listes portant le même nom.
  Attendu : L’absence complète affiche non configuré sans appel OVH ; une configuration partielle ou invalide bloque les opérations avec une erreur ne révélant aucun identifiant.

- [ ] **TECH03 — Simuler une panne et une tâche OVH en attente**
  Action : Faire injecter une réponse 503 ou des tâches non terminées dans une instance Smocker dédiée, puis rétablir le scénario.
  Attendu : La panne n’est pas présentée comme un succès ; les tâches en attente bloquent une nouvelle application. Une actualisation permet de reprendre après rétablissement, sans relance automatique des écritures.

- [ ] **TECH04 — Tester un envoi SMTP incertain**
  Action : Avec un SMTP de test contrôlé, faire interrompre un envoi après acceptation possible, puis examiner le message.
  Attendu : Le résultat incertain est distingué d’un échec certain ; aucune nouvelle tentative automatique ne risque de doubler l’envoi. La reprise nécessite une vérification explicite.

- [ ] **TECH05 — Tester une erreur de formulaire et sa reprise**
  Action : Faire échouer une requête d’enregistrement ; pour un membre neuf, faire échouer l’association à un lot après création de la fiche puis reprendre.
  Attendu : La saisie reste disponible ; la reprise réutilise la fiche déjà créée et ne produit pas de doublon.

- [ ] **TECH06 — Vérifier les lectures concurrentes et obsolètes**
  Action : En ralentissant les réponses, changer rapidement de budget ou de filtre ; avec deux administrateurs de test, modifier la même fiche de compte avant confirmation.
  Attendu : Aucune donnée de l’ancien contexte ne remplace la nouvelle. Une décision sur une version obsolète d’un compte est refusée avec invitation à actualiser.

- [ ] **TECH07 — Contrôler les protections et migrations sur copie**
  Action : Faire relire les résultats de tests isolés : maintien du dernier administrateur, paiements/publications concurrents, base neuve et restauration d’une sauvegarde puis migrations 0001 à 0007.
  Attendu : Les contraintes restent respectées ; les anciennes données et droits sont conservés. Aucune réinitialisation ou migration expérimentale n’est effectuée sur la base de validation courante.

- [ ] **TECH08 — Traiter les limites de calcul**
  Action : Sur un jeu de données isolé, tester un total de parts nul, des répartitions au centime, une référence budgétaire nulle et des paiements proches du changement d’année Europe/Paris.
  Attendu : Aucune division par zéro ni pourcentage inventé ; les centimes alloués égalent le total et les mois/années utilisent la date métier et le fuseau attendus.

## Clôture de la séance

Lots : validation finale transversale ; ne vaut pas autorisation de production.

- [ ] **END01 — Relever les écarts**
  Action : Pour chaque échec ou blocage, noter l’identifiant du test, les étapes, le résultat observé, le résultat attendu et si utile une capture sans secret.
  Attendu : Les écarts peuvent être reproduits ; un cas non exécuté n’est pas présenté comme réussi. Mentionner les variantes non disponibles.

- [ ] **END02 — Préserver les données de recette**
  Action : Noter les objets TEST créés et les changements à conserver ou à annuler. Restaurer uniquement les valeurs de test connues si nécessaire.
  Attendu : Les données historiques et droits sont préservés ; les écritures financières publiées restent traçables, sans suppression forcée de l’historique. Ne pas supprimer de volume Docker.

- [ ] **END03 — Exporter et prononcer une décision**
  Action : Exporter la fiche remplie ou son JSON et indiquer « Validé », « Validé avec réserves » ou « À corriger », avec les identifiants concernés.
  Attendu : Une trace de la validation est conservée et peut être jointe à la conversation. Le résultat concerne le local ; les identifiants réels OVH, Google production et vérifications Helm restent à traiter séparément avant toute production autorisée.

Décision : ____________________

Réserves / anomalies (ID, observé, attendu, reproduction) :

________________________________________________________________________________

________________________________________________________________________________

Couverture : lots 1–18 et ajouts dashboard/OVH/Smocker/Viper. La modernisation technique et les migrations sont relues via leurs résultats de tests ; les parcours ci-dessus permettent la vérification humaine des comportements visibles. Aucun contrôle de production n’est déclaré réalisé par cette fiche.
