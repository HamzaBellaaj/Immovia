# Immovia — frontend du Sprint 1

Angular 21 standalone, formulaires réactifs, CSS et assets issus des maquettes.
Le [README racine](../README.md) décrit l'installation, les secrets côté serveur,
la configuration Supabase et la recette complète.

```powershell
npm ci
npm start
```

Application : http://localhost:4200/connexion. Build : `npm run build`.
Angular appelle par défaut `http://localhost:8000`, comme le backend.
Si le port change, définir `API_BASE_URL` avant le démarrage Angular et utiliser
le même port côté Spring Boot (`SERVER_PORT`).

## Configuration publique

`scripts/configure.mjs` utilise uniquement `API_BASE_URL`, `SUPABASE_URL` et
`SUPABASE_PUBLISHABLE_KEY` (anciens alias `PUBLIC_*` conservés). Copier
`.env.example` vers `.env` pour des valeurs locales. Le fichier TypeScript est
généré après installation et avant démarrage/build. Les valeurs Supabase fournies
sont publiques. Aucune clé privée ne doit y être placée.

## Fonctionnalités

Routes : `/connexion`, `/inscription`, `/verification-email`, `/auth/callback`,
`/mot-de-passe-oublie`, `/nouveau-mot-de-passe`, `/profil`, `/devenir-proprietaire`.
Les deux dernières sont protégées. AuthService utilise le SDK Supabase pour les
inscriptions, sessions, mots de passe, Google et déconnexion. Le callback traite
PKCE, fragments de session et `token_hash`. La récupération exige un contexte
valide, associé au compte et limité dans le temps, puis une vérification Supabase.
Les templates `ConfirmationURL` restent utilisables ; vérifier l'allowlist
`http://localhost:4200/**` dans Supabase. Aucun service SMTP ou OAuth n'est recréé.

ProfileService appelle POST sync puis GET me après connexion/retour OAuth. Il
utilise le contrat canonique `ProfileDto` (`firstName`, `lastName`, `phone`,
`isOwner`, dates), puis l'adapte au modèle d'affichage français. PUT n'envoie que
les trois champs modifiables. Après modification/activation, GET me confirme le
résultat. Une réponse invalide ou un serveur absent produit une erreur visible,
jamais des données de démonstration.

L'interceptor ajoute le Bearer uniquement aux appels `/api/profile/*` de l'origine
backend configurée. Le SDK gère les JWT et leur renouvellement ; les contrôles
définitifs de signature et d'accès appartiennent à Spring Security.

## Tests navigateur reproductibles

En developpement (`npm start` ou build `--configuration development`), le profil
affiche un bouton discret **Copier le token pour Postman**. Il utilise la session
Supabase courante via `auth.getSession()` et copie uniquement son `access_token`.
Dans Postman, choisir **Authorization > Bearer Token**, puis coller la valeur.
Le token n'est ni affiche ni journalise et aucun stockage supplementaire n'est ajoute.
Le build de production remplace ce composant par un composant vide : le bouton et
le code de copie sont absents. Le refus du presse-papiers affiche un message sans token.

```powershell
npm run build
npm run test:browser
```

Playwright sert le build sur un port libre, sans interrompre `ng serve`, et
utilise Edge installé (`BROWSER_CHANNEL=chrome` pour Chrome). À défaut :
`npx playwright install chromium`, puis `$env:BROWSER_CHANNEL='chromium'`.
Les tests supposent le build configuré pour l'API par défaut localhost:8000.

Quatorze scénarios vérifient les formulaires, routes, payloads canoniques, Bearer,
callbacks Google/confirmation/récupération, rechargement, erreurs backend et mobile.
Auth et REST sont remplacés **uniquement dans le script de test** par des doubles
réseau. Ils ne valident pas une authentification Google humaine, un e-mail réellement
reçu ou une écriture PostgreSQL. Captures : `test-results/` (ignoré par Git).

Pour verifier aussi le bouton et les refus du presse-papiers sur le build de developpement :

```powershell
npm run build -- --configuration development --output-path dist/immovia-frontend-dev
$env:APP_BUILD_PATH = '../dist/immovia-frontend-dev/browser'
$env:EXPECT_POSTMAN_TOOLS = 'true'
npm run test:browser
Remove-Item Env:APP_BUILD_PATH, Env:EXPECT_POSTMAN_TOOLS
```
