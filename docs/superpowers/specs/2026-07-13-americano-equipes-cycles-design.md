# Americano par équipes et cycles automatiques

Date : 13 juillet 2026
Statut : conception validée par l'utilisateur

## 1. Contexte

PadelPro sait déjà organiser un Americano avec un nombre de joueurs qui n'est
pas un multiple de quatre. Le moteur forme des binômes variables, répartit les
repos et calcule un classement individuel. Avec six joueurs, quatre jouent et
deux se reposent à chaque round.

Il manque toutefois une variante permettant de conserver les binômes pendant
tout l'événement, de les composer dans l'application et de faire jouer un
championnat complet plutôt qu'un tableau à élimination directe.

Cette évolution enrichit le format `americano` existant. Elle ne crée pas un
quatrième format qui ferait doublon avec l'Americano actuel.

## 2. Objectifs

- Proposer des binômes remixés ou fixes dans un Americano.
- Accepter les nombres pairs non multiples de quatre, notamment 6, 10 et 14.
- Composer les équipes manuellement, aléatoirement ou selon le niveau.
- Calculer automatiquement une durée de cycle équitable.
- Permettre d'ajouter des cycles après le premier sans perdre l'historique.
- Afficher un classement individuel en remixé et un classement collectif en
  fixe.
- Préserver intégralement les Americanos déjà enregistrés.

## 3. Terminologie

- **Variante remixée** : les partenaires peuvent changer à chaque round et le
  classement est individuel.
- **Variante fixe** : chaque binôme reste identique pendant tous les cycles et
  le classement est par équipe.
- **Cycle** : planning automatique complet et équitable. Un nouveau cycle est
  ajouté uniquement lorsque tous les matchs du précédent sont terminés.
- **Composition** : stratégie utilisée pour former les binômes : manuelle,
  aléatoire ou équilibrée.

## 4. Périmètre fonctionnel

### 4.1 Variante remixée

- Le comportement historique de l'Americano reste la base : quatre joueurs
  par match, partenaires variables, points cumulés individuellement et repos
  répartis.
- Les compositions disponibles sont `random` et `balanced`.
- Le mode équilibré continue de tenir compte du niveau et du côté préféré.
- Un cycle supplémentaire prend en compte tous les matchs antérieurs pour
  minimiser les répétitions de partenaires et d'adversaires.
- Les anciens événements conservent leur nombre de rounds enregistré. Le
  calcul automatique concerne les nouveaux événements.

Pour les nouveaux événements, le moteur calcule `rounds_per_cycle` après la
saisie du roster et du nombre de terrains :

1. La capacité active d'un round est le plus petit nombre entre les places
   offertes par les terrains et le plus grand multiple de quatre inférieur ou
   égal au nombre de joueurs.
2. Pour un nombre de joueurs congru à 2 modulo 4, un cycle contient `N / 2`
   rounds. Cette règle donne un cycle compact dont les présences et les repos
   sont exactement équilibrés.
3. Pour les autres rosters compatibles avec l'Americano historique, la durée
   vise au moins `N - 1` rounds et est prolongée au premier nombre de rounds
   permettant une distribution égale des présences. Cela préserve la variété
   des partenaires sans créer de régression pour les groupes impairs ou
   multiples de quatre.

Exemple cible avec 6 joueurs et 1 terrain : 3 rounds, 2 matchs et 1 repos par
joueur, sans partenaire répété lorsqu'une solution existe.

### 4.2 Variante fixe

- Le roster doit contenir un nombre pair de joueurs, avec un minimum de quatre.
- Chaque joueur appartient à exactement une équipe de deux avant le lancement.
- Les compositions disponibles sont `manual`, `random` et `balanced`.
- Le mode équilibré associe prioritairement des niveaux complémentaires et
  évite deux préférences de côté strictement identiques lorsqu'une alternative
  existe.
- Une équipe est libellée automatiquement avec les noms de ses deux joueurs.
- Les équipes sont verrouillées au lancement et restent identiques dans les
  cycles supplémentaires.

Chaque cycle est un championnat aller simple : chaque paire d'équipes se
rencontre exactement une fois. Le générateur respecte les contraintes
suivantes :

- une équipe ne joue pas deux fois dans le même round ;
- le nombre de matchs simultanés ne dépasse pas le nombre de terrains ;
- les repos sont répartis par la méthode de rotation du round-robin ;
- si les terrains sont moins nombreux que les matchs d'un round logique, le
  moteur crée les vagues supplémentaires nécessaires ;
- les terrains et les côtés sont alternés autant que possible entre les
  cycles.

Exemple cible avec 6 joueurs : 3 équipes, 3 rounds et 3 matchs au total. Chaque
équipe affronte les deux autres et se repose une fois.

### 4.3 Cycles supplémentaires

Lorsque tous les matchs du cycle courant sont terminés, l'organisateur voit
deux actions :

- `Ajouter un cycle` ;
- `Terminer l'événement`.

En remixé, le nouveau cycle utilise tout l'historique pour trouver de nouvelles
associations. En fixe, il rejoue le championnat avec les mêmes équipes, tout en
variant l'ordre, les terrains et l'affectation équipe 1/équipe 2.

Un cycle ne peut être ajouté ni à un brouillon, ni à un événement terminé, ni
tant qu'un score du cycle courant manque.

## 5. Classements et podiums

### 5.1 Remixé

Le classement individuel actuel est conservé : points marqués, puis victoires,
différence de points et nom. Les matchs d'un cycle supplémentaire sont cumulés
avec les précédents.

### 5.2 Fixe

Une ligne représente un binôme et contient au minimum : matchs joués,
victoires, nuls, défaites, points pour, points contre et différence.

L'ordre de classement est :

1. nombre de victoires ;
2. différence de points ;
3. points marqués ;
4. confrontation directe pour une égalité entre deux équipes ;
5. libellé de l'équipe pour garantir un ordre stable si l'égalité persiste.

Lorsque plusieurs cycles ont été joués, la confrontation directe agrège tous
les matchs entre les deux équipes concernées. Le podium de fin d'événement
affiche les trois meilleures équipes et leurs deux membres.

Les matchs nuls restent autorisés, comme dans l'Americano actuel.

## 6. Parcours utilisateur

### 6.1 Création

Le wizard existant reste composé de trois étapes.

1. **Format** : l'utilisateur choisit Americano comme aujourd'hui.
2. **Réglages** : il choisit `Individuel · remixé` ou `Par équipes · fixe`, le
   nombre de terrains, les points par match et la stratégie de composition.
3. **Joueurs** : il saisit le roster. L'application calcule ensuite la durée du
   cycle et affiche un résumé avant la création.

En composition manuelle, l'étape Joueurs permet d'assembler tous les binômes.
Une interaction par sélection et échange est préférée au glisser-déposer seul,
afin de rester utilisable au clavier et sur mobile.

En composition aléatoire ou équilibrée, un aperçu est présenté. Le bouton
`Refaire le tirage` est disponible tant que l'événement est en brouillon. Toute
modification du roster invalide l'aperçu et impose une nouvelle composition.

Le résumé indique par exemple : `6 joueurs · 3 équipes · 3 rounds · 1 repos
par équipe`.

### 6.2 Brouillon et lancement

La page d'administration affiche les équipes prévisualisées. En variante fixe,
le lancement est désactivé si un joueur n'est pas affecté, si une équipe ne
contient pas exactement deux membres ou si le roster est impair.

Au lancement, le planning du premier cycle est créé et les affectations fixes
sont verrouillées.

### 6.3 Événement actif

- Les badges indiquent la variante et le cycle courant.
- Les sélecteurs de rounds restent compatibles avec le swipe mobile.
- Les personnes au repos sont affichées en remixé ; les équipes au repos sont
  affichées en fixe.
- Les cartes de match, le QR code, l'annonce optimiste des scores et le temps
  réel sont réutilisés sans modifier leur modèle mental.
- Le participant continue de voir son prochain match et son partenaire.

## 7. Modèle de données

Le champ `events.format` reste égal à `americano`. Les nouveaux champs de
`settings` sont :

```ts
team_mode?: "remixed" | "fixed";
composition?: "manual" | "random" | "balanced";
rounds_per_cycle?: number;
```

L'absence de ces champs signifie `remixed` avec le comportement historique et
le nombre de rounds déjà stocké dans `settings.rounds`. Un helper de lecture
centralise les valeurs de repli : `team_mode` vaut `remixed`, `composition`
reprend l'ancien champ `pairing`, et la durée vaut
`rounds_per_cycle ?? rounds`. Les nouveaux événements écrivent aussi
`settings.rounds = rounds_per_cycle` pour que les consommateurs historiques
restent fonctionnels pendant la transition.

Deux colonnes sont ajoutées par migration :

- `event_players.team_number integer null` : identifiant local du binôme fixe ;
- `matches.cycle_number integer not null default 1` : cycle auquel appartient
  le match.

Les numéros de round restent globaux et croissants dans un événement. Le round
local affiché dans un cycle est dérivé de `rounds_per_cycle`. Cette décision
préserve les tris, les historiques et les pages existantes.

Une contrainte d'unicité partielle protège les matchs sans bracket contre deux
insertions sur le même événement, cycle, round et terrain. L'ajout de cycle
doit aussi être validé côté serveur : propriétaire de l'événement, statut
`active`, cycle précédent terminé et numéro de cycle attendu.

La modification de `team_number` est permise uniquement lorsque l'événement
est en brouillon. Les opérations de claim d'un profil joueur restent autorisées
pendant un événement actif.

## 8. Architecture applicative

### 8.1 Moteurs

Le moteur Americano est étendu par des unités distinctes :

- planification de la durée équitable d'un cycle remixé ;
- génération d'un cycle remixé à partir d'un historique existant ;
- composition des équipes fixes ;
- génération round-robin d'un cycle fixe ;
- audit d'intégrité et d'équité du planning.

Les fonctions exposent des entrées et sorties explicites et restent
indépendantes de Supabase.

### 8.2 Actions et flux de données

- La création enregistre le mode, la composition, la durée calculée et les
  `team_number` éventuels.
- `startEvent` choisit le générateur remixé ou fixe puis insère le cycle 1.
- Une action dédiée reconstruit l'historique depuis les matchs existants et
  prépare le cycle suivant.
- Une opération serveur atomique vérifie l'état courant avant d'insérer le
  nouveau cycle. La contrainte d'unicité rend un double clic idempotent du point
  de vue utilisateur : une seule génération est conservée, puis l'interface se
  resynchronise.
- `useEvent` continue de charger événements, joueurs et matchs ; les deux
  nouvelles colonnes voyagent dans les objets existants.

### 8.3 Présentation

- Le classement individuel existant reste inchangé.
- Un calculateur et une vue de classement par équipe sont ajoutés pour la
  variante fixe.
- Le podium choisit automatiquement ses lignes individuelles ou collectives.
- Les pages organisateur et participant déterminent les libellés de cycle,
  round et repos depuis les mêmes helpers pour éviter des divergences.

## 9. Erreurs et protections

L'interface doit fournir des messages français explicites pour les cas
suivants :

- minimum de joueurs non atteint ;
- nombre impair en variante fixe ;
- joueur sans équipe ou équipe incomplète ;
- composition devenue obsolète après une modification du roster ;
- cycle courant encore incomplet ;
- événement qui n'est plus actif ;
- cycle déjà ajouté par une autre requête ;
- génération impossible ou insertion refusée.

Une erreur d'ajout de cycle ne modifie pas les matchs existants. Après un
conflit ou une perte de connexion, l'application recharge l'événement avant de
proposer une nouvelle tentative.

## 10. Compatibilité

- Aucun nouveau `EventFormat` n'est introduit.
- Le contrôle SQL actuel des scores Americano continue de s'appliquer.
- Les anciens matchs reçoivent `cycle_number = 1` par défaut.
- Les anciens joueurs conservent `team_number = null`.
- Les anciens événements sans `team_mode` continuent d'utiliser
  `settings.rounds` et sont rendus comme des Americanos remixés classiques.
- Les statistiques et l'Elo restent calculés pour chaque membre du match, y
  compris lorsque le classement visible est collectif.

## 11. Vérification et critères d'acceptation

### 11.1 Tests unitaires du moteur

- 6 joueurs remixés, 1 terrain : 3 rounds, 2 matchs et 1 repos par joueur,
  intégrité des matchs et absence de partenaire répété lorsqu'elle est
  réalisable.
- 6 joueurs fixes : 3 équipes, 3 matchs, chaque confrontation exactement une
  fois et un repos par équipe.
- 10 joueurs fixes et remixés avec 1 puis 2 terrains : capacité respectée,
  aucun joueur en double dans un round et repos équitables.
- Composition manuelle, aléatoire et équilibrée, y compris les préférences de
  côté.
- Deuxième cycle remixé : historique pris en compte.
- Deuxième cycle fixe : équipes inchangées et rencontres complètes.
- Audit des contraintes pour un échantillon de rosters plus grands.

### 11.2 Classement

- Cumul exact des statistiques par équipe.
- Ordre par victoires, différence, points marqués et confrontation directe.
- Agrégation correcte de la confrontation directe sur plusieurs cycles.
- Podium collectif contenant les deux membres de chaque équipe.

### 11.3 Données et compatibilité

- Migration des anciennes lignes vers le cycle 1.
- Lecture inchangée d'un ancien Americano.
- Rejet d'une modification d'équipe après lancement.
- Rejet d'un cycle prématuré et protection contre une double insertion.

### 11.4 Parcours navigateur

Un scénario mobile de bout en bout couvre : création d'un Americano fixe à six
joueurs, composition manuelle, lancement, consultation participant, annonce de
scores, classement collectif, ajout d'un cycle et clôture. Un second scénario
couvre le tirage remixé automatique et son résumé d'équité.

La livraison exige également : tests moteur verts, lint sans erreur, build de
production réussi et absence d'erreur JavaScript dans les scénarios E2E.

## 12. Hors périmètre

- Binômes fixes avec un nombre impair de joueurs.
- Remplaçant ou joueur volant.
- Modification des équipes ou du roster après lancement.
- Suppression ou réécriture rétroactive d'un cycle terminé.
- Noms, logos ou couleurs d'équipes personnalisés.
- Classement inter-événements par équipe permanente.
