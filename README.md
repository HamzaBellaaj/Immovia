# Immovia — Sprint 1 : authentification et profils

Projet universitaire L3 DSI. Angular standalone, TypeScript et CSS ; API Java 21 /
Spring Boot REST ; Supabase Auth (e-mail, Google et JWT ES256) ; PostgreSQL Supabase.

Le code du Sprint 1 est développé et les vérifications automatisées passent.
La recette complète sur les services réels reste à effectuer : aucun vrai mot de
passe PostgreSQL, compte Google ou accès à une boîte e-mail n'est disponible dans
cette session. Le [rapport de vérification](docs/SPRINT1-VERIFICATION.md) distingue
les contrôles exécutés des parcours restant à valider.

## Prérequis et structure

- Node.js 22.12+ dans la branche 22.x et npm.
- Java 21 et Maven 3.6.3+ ; Spring Boot 3.5.16 est conservé.
- Une connexion internet vers Supabase et le vrai mot de passe PostgreSQL local.
- Postman pour la recette API ; Edge installé pour les tests navigateur par défaut.

```text
frontend/   Angular, services Auth/Profile, guards, formulaires et tests navigateur
backend/    Spring Boot, JWT/JWKS, JPA, DTO, contrôleurs et tests
maquettes/  Références visuelles originales — ne pas modifier
postman/    Collection, environnement vide et documentation de recette
docs/       Rapport et checklist du Sprint 1
```

## Configuration et variables

| Application | Variables | Valeurs par défaut / usage |
| --- | --- | --- |
| Angular | `API_BASE_URL` | `http://localhost:8000` |
| Angular | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Configuration publique du projet fournie dans `frontend/.env.example` |
| Spring | `SERVER_PORT`, `FRONTEND_URL` | `8000`, `http://localhost:4200` |
| Spring | `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_URI` | Projet Supabase et endpoints Auth/JWKS indiqués dans `backend/.env.example` |
| Spring | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME` | Pooler `aws-1-eu-central-1.pooler.supabase.com`, `5432`, `postgres`, `postgres.koihgmmtxqlbuexewurx` |
| Spring | `DB_PASSWORD` | Obligatoire au démarrage ; aucune valeur par défaut ni placeholder utilisé |

Angular accepte un fichier `frontend/.env` local, copié si nécessaire depuis
`.env.example`, puis génère sa configuration publique avant le démarrage/build.
Les anciens noms `PUBLIC_*` restent compatibles. Redémarrer après modification.
**Spring Boot ne charge pas automatiquement `.env`** : exporter ses variables dans
le terminal ou les configurer dans l'IDE. Les vrais secrets et les exports Postman
`*.local.json` sont ignorés par Git. Ne pas commiter de token, mot de passe, clé
service_role ou clé SMTP. Aucun de ces secrets n'est nécessaire dans Angular.

## Démarrage habituel

Terminal PowerShell 1, à la racine :

```powershell
$databaseSecret = Read-Host 'Vrai mot de passe PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
Remove-Variable databaseSecret
mvn -f backend/pom.xml spring-boot:run
# Après arrêt du serveur :
Remove-Item Env:DB_PASSWORD
```

Terminal PowerShell 2, à la racine :

```powershell
npm --prefix frontend ci
npm --prefix frontend start
```

Angular : http://localhost:4200/connexion. API : http://localhost:8000/api/health.
Health doit répondre `{"status":"UP","application":"immovia-backend"}`.

**Particularité constatée sur ce poste : le port 8080 est occupé par Oracle
`TNSLSNR`, qui renvoie une page HTML 404. Ce n'est pas Immovia.** Ne pas arrêter un
service sans en vérifier l'usage. Pour conserver Oracle et utiliser temporairement
8081, ajouter avant la commande Maven, dans le terminal backend :

```powershell
$env:SERVER_PORT = '8081'
```

Dans le terminal Angular, avant `npm --prefix frontend start` :

```powershell
$env:API_BASE_URL = 'http://localhost:8081'
```

Configurer également `base_url=http://localhost:8081` dans la valeur locale de
l'environnement Postman. CORS conserve l'origine frontend `http://localhost:4200`.
Les valeurs par défaut du projet sont 4200/8000. Pour revenir à 8000, retirer
ces deux variables de leurs terminaux respectifs et redémarrer les applications.

## PostgreSQL

Le profil Spring par défaut `supabase` utilise la connexion PostgreSQL serveur en
SSL (`sslmode=require`) et `spring.jpa.hibernate.ddl-auto=validate`.
La table `public.profiles` existe déjà : UUID référant `auth.users`, noms, e-mail,
téléphone, `is_owner` et dates. Aucun CREATE/UPDATE de schéma ni migration n'est lancé.

Le rôle serveur doit déjà avoir les privilèges requis malgré RLS. Les clients
Supabase `anon` et `authenticated` ne doivent pas recevoir de droits directs pour
modifier `is_owner`. Le backend dérive l'UUID du JWT vérifié, crée avec
`ON CONFLICT DO NOTHING`, puis complète les noms et l'e-mail manquants sous verrou.
Le téléphone est récupéré depuis les métadonnées d'inscription uniquement pour
un profil qui n'a pas encore été modifié, afin de préserver un effacement volontaire.
L'e-mail est une copie informative de l'identité Auth ; il ne se modifie pas via PUT.
Les modifications et l'activation utilisent une transaction avec verrou de ligne.

La connexion JDBC, le schéma réel, les permissions et les écritures restent à
vérifier avec le vrai mot de passe. Health confirme le fonctionnement HTTP, pas
une connexion SQL à chaque appel. Voir [backend/README.md](backend/README.md).

## Supabase Auth, Google et récupération

Les réglages publics du projet ont été consultés : e-mail et Google activés,
inscription autorisée, confirmation e-mail obligatoire ; JWKS EC P-256 / ES256.
Les paramètres d'administration, SMTP et templates n'ont pas été modifiés.

Dans **Supabase → Authentication → URL Configuration**, vérifier manuellement :

- **Site URL** : `http://localhost:4200`.
- **Redirect URLs** pour le développement : `http://localhost:4200/**`.
- En production, remplacer ces URLs de développement par les URLs réelles autorisées.

Le frontend transmet explicitement `http://localhost:4200/auth/callback` à
`signUp`, `signInWithOAuth` et `resetPasswordForEmail`. Une redirection non autorisée
peut retomber sur Site URL. Ces règles sont décrites dans la
[documentation Supabase des redirections](https://supabase.com/docs/guides/auth/redirect-urls).

Google doit conserver son callback fournisseur
`https://koihgmmtxqlbuexewurx.supabase.co/auth/v1/callback` dans Google Cloud.
Supabase redirige ensuite vers Angular. Ne pas le remplacer par le callback Angular.
Ce réglage, déclaré déjà configuré, n'a pas été modifié ni validé par une connexion humaine.

Pour les e-mails, conserver le lien du template :

```html
<a href="{{ .ConfirmationURL }}">Réinitialiser mon mot de passe</a>
```

Il passe par la vérification Supabase, puis vers la redirection demandée.
Ne pas le remplacer par `{{ .SiteURL }}` ou un lien direct vers le formulaire sans
vérification. Voir la [documentation des templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Le callback Angular est traité **avant** les redirections du Router, même si le
lien arrive à la racine. Les codes PKCE sont échangés par le SDK ; son événement
`PASSWORD_RECOVERY` ouvre `/nouveau-mot-de-passe`. Les fragments de session avec
`type=recovery` et les liens `token_hash` sont aussi pris en charge. Les paramètres
sensibles sont retirés de l'URL. Une session ordinaire ne suffit pas pour afficher
le formulaire de récupération ; le contexte temporaire est vérifié puis Supabase
valide la session avant `updateUser`.

**Aucun changement de template n'est identifié comme nécessaire avec
`ConfirmationURL`.** L'action manuelle à vérifier est l'allowlist ci-dessus.
La réception et le clic sur un vrai e-mail ne sont pas testés. Avec PKCE, ouvrir le
lien dans le navigateur qui a initié la demande, où se trouve le vérificateur.

## Contrat API et Angular

Health est public. Les quatre routes `/api/profile/*` nécessitent un Bearer Supabase :
POST `sync`, GET/PUT `me`, POST `become-owner`. Spring vérifie la signature ES256,
l'issuer, les dates, l'audience `authenticated`, le rôle et l'identité de session.
Les erreurs sont en JSON et CORS autorise Angular, Authorization et les méthodes requises.

Le contrat canonique est `id`, `firstName`, `lastName`, `email`, `phone`, `isOwner`,
`createdAt`, `updatedAt`. Angular le vérifie et l'adapte aux noms français de ses
formulaires. PUT envoie uniquement `firstName`, `lastName`, `phone`. Les limites sont
identiques côté client et serveur : noms 100 caractères, téléphone 30 caractères.
Le backend conserve ses alias historiques pour compatibilité. Aucune donnée fictive
ne remplace un backend indisponible ou une réponse incompatible.

## Builds et tests reproductibles

Depuis la racine :

```powershell
npm --prefix frontend run build
mvn -B -ntp -f backend/pom.xml clean verify
npm --prefix frontend run test:browser
node postman/validate.cjs
```

Les tests navigateur servent le build de production sur 4200 : arrêter un éventuel
`ng serve` avant ce test. Ils utilisent Playwright et Edge. Avec Chrome installé,
définir `$env:BROWSER_CHANNEL='chrome'` ; sinon installer le navigateur de test via
`cd frontend`, puis `npx playwright install chromium` et
`$env:BROWSER_CHANNEL='chromium'`. Ces installations ne changent pas l'application.
Les captures se trouvent dans `frontend/test-results/`, ignoré par Git.

Les tests navigateur interceptent Auth et les appels de profil : ils vérifient
l'interface, les requêtes, les callbacks et les erreurs, **pas** la livraison SMTP,
Google réel ou la persistance PostgreSQL. Les tests backend couvrent le décodeur
ES256 avec JWKS de test, les règles MVC et les services. Les tests HTTP démarrent
un vrai Tomcat sur un port libre avec repository remplacé uniquement dans le test.
Aucune configuration de test n'est activable comme profil de l'application livrée.

## Tests Postman et recette manuelle complète

Importer la [collection](postman/Immovia-Sprint1.postman_collection.json) et
l'[environnement](postman/Immovia-Local.postman_environment.json). Après authentification
réelle, copier le Bearer d'une requête privée du navigateur vers la valeur locale
`access_token`. Le token livré est vide. Procédure et assertions :
[postman/README.md](postman/README.md). La collection comporte neuf requêtes,
y compris la répétition de l'activation propriétaire.

Utiliser deux comptes de recette contrôlés, A et B :

1. **Inscription** : prénom, nom, e-mail et mots de passe identiques ; téléphone
   facultatif, conditions obligatoires. Vérifier `/verification-email`, la réception
   de l'e-mail (y compris spam) et le refus de connexion avant confirmation.
2. **Confirmation** : ouvrir le lien reçu dans le même navigateur, vérifier le
   retour callback puis profil. Vérifier POST sync suivi de GET me et une ligne
   `public.profiles` dont l'UUID correspond au compte Auth.
3. **Connexion** : tester le bon et un mauvais mot de passe, recharger `/profil`
   sans perdre la session, puis se déconnecter. Revenir à `/profil` doit rediriger
   vers connexion. Tester également `/devenir-proprietaire` sans session.
4. **Google** : cliquer Continuer avec Google, choisir un compte, autoriser le
   fournisseur, vérifier le retour Angular, la session et la synchronisation.
5. **Récupération** : demander un lien, vérifier le message neutre, recevoir puis
   ouvrir l'e-mail. Vérifier le formulaire de nouveau mot de passe, son rechargement,
   l'erreur de confirmation différente, le changement et le retour connexion.
   Se reconnecter avec le nouveau mot de passe. Tester un lien réutilisé/expiré et
   l'ouverture directe du formulaire sans contexte de récupération.
6. **Profil** : modifier prénom, nom et téléphone, enregistrer, recharger la page,
   se reconnecter, vérifier les mêmes valeurs en PostgreSQL. L'e-mail reste inchangé.
7. **Propriétaire** : accepter l'activation, vérifier `isOwner:true` dans la réponse,
   `is_owner=true` en PostgreSQL et l'interface actualisée. Répéter l'appel sans erreur.
8. **Sécurité** : exécuter Postman sans token, avec token invalide et avec un vrai
   token expiré (401). Essayer PUT `isOwner` (400). Avec B, tenter un identifiant A
   dans Sync ou GET me : seul B doit être retourné. Ne pas utiliser le token de A
   pour prétendre tester l'isolation de B.
9. **Visuel** : comparer les quatre pages aux maquettes, sur ordinateur et mobile ;
   vérifier logo, images, couleurs, boutons, focus clavier, messages et navigation.

Cocher les résultats réels dans la [checklist de recette](docs/SPRINT1-RECETTE.md).
Les étapes humaines et les vérifications en base restent décochées tant qu'elles
n'ont pas été effectuées ; les tests avec doubles réseau ne les remplacent pas.

## Dépannage

| Symptôme | Vérification / correction |
| --- | --- |
| HTML 404 sur 8080 | Oracle TNSLSNR occupe le port ; utiliser les commandes 8081 ci-dessus ou libérer le port en connaissance de son usage |
| Backend ne démarre pas | Définir le vrai `DB_PASSWORD` dans le même terminal que Maven ; vérifier host, port, utilisateur et accès réseau |
| Erreur Hibernate de schéma | Comparer `public.profiles` au mapping ; garder `ddl-auto=validate`, ne pas utiliser create/update |
| Permission denied / RLS | Vérifier les droits du rôle PostgreSQL serveur ; ne pas désactiver RLS ni donner de droits directs aux clients |
| 401 | Utiliser un access token utilisateur récent de ce projet, pas une publishable key ; vérifier ES256/issuer/audience et l'heure système |
| 403 / erreur CORS | Origine exacte `http://localhost:4200`, Authorization et préflight ; `127.0.0.1:4200` est une autre origine |
| 404 profil | Appeler Sync avec le même token avant GET me |
| Réponse profil incompatible | Vérifier le contrat canonique, l'origine API configurée et que le serveur contacté est bien Immovia |
| Callback vers mauvaise page | Vérifier Site URL et Redirect URLs, conserver `ConfirmationURL`, redémarrer Angular après changement de configuration |
| PKCE / lien expiré | Demander un nouveau lien et l'ouvrir dans le navigateur d'origine ; ne pas réutiliser un lien consommé |
| Modifications sans succès confirmé | Vérifier PUT puis GET, droits DB et réponse HTTP ; aucun succès n'est simulé par Angular |

L'audit npm de production ne signale aucune vulnérabilité lors de cette vérification.
L'installation signale 16 vulnérabilités modérées dans les dépendances de développement ;
aucune mise à jour forcée ou montée de version majeure n'a été appliquée.
