# HackerLab Bénin 2027

Application de suivi de préparation sur 24 semaines. L'interface est en français et les dates de validation se réfèrent au fuseau `Africa/Porto-Novo`.

## Fonctionnalités

- Authentification Supabase par email, inscription déclenchée uniquement par invitation et accès admin réservé.
- Planning interactif sur 24 semaines, verrouillage des semaines terminées, cases à cocher et détail des objectifs et ressources.
- Classement individuel lu depuis la vue `leaderboard`, score d'équipe séparé, fil d'activité et grille de progression en lecture seule.
- Administration des invitations, ajustements motivés, annulation/restauration des coches, événements CTF et exports CSV.
- Interface mobile, PWA installable, thème sombre et navigation `HashRouter` pour GitHub Pages.

Le projet utilise Vite, React, TypeScript strict, Tailwind CSS et Supabase. Les règles de points et de sécurité sont appliquées côté base de données.

## Générer le planning

Avec Node.js 22 ou plus récent :

```sh
npm run generate:tasks
```

Le script lit `scripts/compartments.source.json`, puis produit `src/data/compartments.json` et `supabase/seed_tasks.sql`. Les objectifs et liens de ressources viennent du PDF `Plan_HackerLab_2027_Compartiments.pdf`.

Le seed contient 644 tâches, avec des identifiants stables pour pouvoir le réexécuter.

## Installation locale

```sh
npm install
npm run generate:tasks
npm run dev
```

Copier `.env.example` vers `.env.local`, puis renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`. Ces valeurs sont publiques et sont utilisées par l'application cliente. Ne jamais placer de clé `secret` ou `service_role` dans le dépôt ou le navigateur.

`npm run build` vérifie les types TypeScript et compile le site dans `dist/`.

## Configuration Supabase

1. Créer un projet Supabase et ouvrir son SQL Editor.
2. Exécuter `supabase/schema.sql`. Sur un projet déjà initialisé, exécuter les migrations `20261122_signup_specialties.sql` puis `20261123_require_specialties_and_assign_tasks.sql`.
3. Remplacer les adresses `@example.invalid` dans `supabase/seed_invitations.sql` par les vraies adresses, puis exécuter le seed. Kevin est le seul administrateur initial.
4. Exécuter `npm run generate:tasks`, puis le fichier `supabase/seed_tasks.sql` produit par le script.
5. Dans Authentication > URL Configuration, définir l'URL du site et ajouter les URLs locales et GitHub Pages aux redirections autorisées.
6. À l'inscription, chaque membre invité choisit une spécialité principale et une secondaire. La base contrôle les clés choisies, refuse deux fois la même spécialité et attribue automatiquement quatre tâches individuelles par semaine.
7. Désactiver la confirmation par email dans Authentication > Providers > Email pour cette équipe fermée, ou configurer un SMTP.

Les règles sont protégées par RLS, contraintes et fonctions SQL. Le navigateur ne transmet aucune valeur de points : le classement lit la vue SQL `leaderboard`. Le score d'équipe est géré séparément par `team_score_events`.

## Déploiement GitHub Pages

1. Pousser le dépôt sur la branche `main` d'un dépôt GitHub nommé `HLB27` (la base Vite est `/HLB27/`).
2. Dans Settings > Secrets and variables > Actions > Variables, définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Dans Settings > Pages, choisir GitHub Actions comme source. `.github/workflows/deploy.yml` publie chaque push sur `main`.
4. Ouvrir `https://<compte>.github.io/HLB27/` et autoriser cette adresse dans la configuration Supabase.

Le workflow `.github/workflows/keepalive.yml` interroge Supabase une fois par jour avec la clé publishable. GitHub désactive les workflows planifiés après environ 60 jours sans activité dans le dépôt : faire un commit de temps en temps.

Le rôle `anon` a uniquement un droit `SELECT` sur `tasks` pour que ce ping réussisse ; aucune policy RLS ne lui donne de ligne. Un visiteur non connecté reçoit une liste vide. Toutes les autres tables et les vues restent interdites au rôle `anon`.

## Installation sur téléphone et sauvegardes

Ouvrir le site déployé dans un navigateur compatible, puis choisir « Installer l’application » ou « Ajouter à l’écran d’accueil ». La PWA met en cache l'interface ; les validations nécessitent une connexion à Supabase.

Dans Administration, exporter régulièrement les coches, ajustements, événements du score d'équipe et classement en CSV. Le plan Supabase gratuit n'inclut pas de sauvegardes quotidiennes.

## Hypothèses retenues

- Les simulations de 48 h sont placées en S21 et S23 ; S20 et S22 servent à préparer les rôles et à faire le débrief.
- En S1, chaque membre reçoit quatre tâches d'installation et de mise en place, plus une séance collective de configuration.
- En S24, la tâche individuelle officielle est la relecture des notes et la préparation du premier jour ; trois créneaux libres restent disponibles.
- Les quatre semaines sans présentation d'un membre par cycle suivent la répartition principale, principale, secondaire, principale prévue dans le PDF.
- Les trois créneaux libres supplémentaires sont génériques et n'imposent aucun compartiment.
- Le module Système / pwn de Kevin est optionnel, proposé mais non compté comme spécialité.

## État et vérification

Les étapes de construction 1 à 10 sont implémentées. `npm run build` passe avec vérification TypeScript et génération du manifeste PWA et du service worker. Après insertion des seeds, exécuter `supabase/tests.sql` pour vérifier la structure du schéma, les dates et la couverture du planning. Les tests d'accès et d'authentification devront être faits sur le vrai projet Supabase avec des comptes d'essai : aucune adresse réelle, clé ou instance Supabase n'est configurée dans ce dépôt.
