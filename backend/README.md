# Immovia — API Spring Boot du Sprint 1

Java 21, Spring Boot 3.5.16 et Maven. Les versions et dépendances existantes sont
conservées. Authentification exclusivement par les JWT Supabase : aucun endpoint
de connexion, aucune émission de JWT et aucune clé service_role.

## Démarrer sous Windows / PowerShell

Depuis VS Code ouvert sur la racine Immovia : ouvrir **Exécuter et déboguer**,
sélectionner **Immovia - Supabase**, puis appuyer sur **F5**. La configuration
Le mot de passe est lu automatiquement depuis le fichier local
`config/application-secrets.local.properties`, ignore par Git et externe au JAR.
La configuration `.vscode/launch.json` ne demande plus de saisie a chaque lancement.
Les variables définies dans un autre terminal ne sont pas automatiquement
transmises au lancement Java de l'IDE.

La configuration utilise `src/main/resources/application.properties` et
`src/main/resources/application-supabase.properties` pour le profil `supabase`.
Spring Boot ne charge pas automatiquement les fichiers `.env`.
`backend/.env.example` documente les variables. Les adresses publiques ci-dessous
sont également les valeurs par défaut de la configuration.

```powershell
cd backend
$env:DB_HOST = 'aws-1-eu-central-1.pooler.supabase.com'
$env:DB_PORT = '5432'
$env:DB_NAME = 'postgres'
$env:DB_USERNAME = 'postgres.koihgmmtxqlbuexewurx'
$env:SUPABASE_URL = 'https://koihgmmtxqlbuexewurx.supabase.co'
$env:SUPABASE_JWT_ISSUER = "$env:SUPABASE_URL/auth/v1"
$env:SUPABASE_JWKS_URI = "$env:SUPABASE_URL/auth/v1/.well-known/jwks.json"
$env:FRONTEND_URL = 'http://localhost:4200'

# Facultatif si config/application-secrets.local.properties fournit deja DB_PASSWORD.
# Pour utiliser plutot une variable d'environnement :
$databaseSecret = Read-Host 'Mot de passe PostgreSQL réel' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
Remove-Variable databaseSecret
mvn spring-boot:run

# Après l'arrêt du serveur : retirer la variable de cette session PowerShell.
Remove-Item Env:DB_PASSWORD
```

Serveur : http://localhost:8000. Le profil par défaut est `supabase` ; l'ancien
profil local qui désactivait la persistance a été retiré. Un vrai mot de passe
est nécessaire pour démarrer l'application complète, mais pas pour compiler et
exécuter les tests isolés. Le fichier local de secrets n'est pas livre dans le JAR.

La connexion JDBC exige `sslmode=require`. Hibernate utilise exclusivement
`ddl-auto=validate` : la table existante `public.profiles` doit correspondre au
mapping JPA. Aucun DDL, migration ou modification des règles RLS n'est exécuté.
Le rôle PostgreSQL configuré doit déjà disposer des droits serveur nécessaires
sur cette table malgré RLS ; ne pas accorder ces droits aux clients Supabase.

## Endpoints

### Swagger UI en developpement

Spring Boot 3.5.16 utilise `springdoc-openapi-starter-webmvc-ui` 2.10.0.
La documentation est generee automatiquement depuis les controleurs et DTO existants.
Avec `DB_PASSWORD` defini localement, lancer depuis `backend/` :

```powershell
mvn spring-boot:run "-Dspring-boot.run.profiles=supabase,dev"
```

Dans le lancement Java de l'IDE, utiliser `SPRING_PROFILES_ACTIVE=supabase,dev`.
Le lancement VS Code **Immovia - Supabase** active ces deux profils automatiquement.
Un lancement avec uniquement `supabase` renvoie 401 sur la documentation : le profil
`dev` est obligatoire. Redemarrer le backend apres modification des profils.
Le port reste 8000 par defaut (sauf surcharge de `SERVER_PORT`).

- Swagger UI : http://localhost:8000/swagger-ui.html
- OpenAPI JSON : http://localhost:8000/v3/api-docs
- OpenAPI YAML : http://localhost:8000/v3/api-docs.yaml

Dans **Authorize**, coller uniquement l'access token d'un utilisateur Supabase connecte,
sans le prefixe `Bearer`. Swagger ajoute l'en-tete `Authorization: Bearer ...` aux
operations de profil. Health reste public. Aucune cle API Supabase ni mot de passe
PostgreSQL n'est utilise pour autoriser les requetes Swagger.
L'autorisation n'est pas conservee au rechargement de Swagger UI.

Sans profil `dev`, ou avec le profil `prod`, la documentation est desactivee et ses
routes ne sont pas publiques. En production, definir explicitement les profils
requis, par exemple `SPRING_PROFILES_ACTIVE=supabase`, sans `dev`.

| Méthode | Route | Authentification / résultat |
| --- | --- | --- |
| GET | `/api/health` | Public, `{"status":"UP","application":"immovia-backend"}` |
| POST | `/api/profile/sync` | Bearer ; crée si absent et retourne le profil existant sinon |
| GET | `/api/profile/me` | Bearer ; profil de l'identité du JWT |
| PUT | `/api/profile/me` | Bearer ; modifie uniquement prénom, nom et téléphone |
| POST | `/api/profile/become-owner` | Bearer ; activation idempotente du statut propriétaire |

`GET /api/health` indique que le processus HTTP est opérationnel ; ce n'est pas
une sonde de connexion PostgreSQL.

Requête de modification :

```json
{"firstName":"Amira","lastName":"Exemple","phone":"+216 22 333 444"}
```

Prénom et nom obligatoires, 100 caractères maximum ; téléphone facultatif,
30 caractères maximum. Le téléphone vide est normalisé en `null`. Tout champ
supplémentaire (`id`, `email`, `isOwner`, `owner`, dates, etc.) est rejeté avec 400.
Les corps des POST de synchronisation et d'activation sont ignorés : ils ne
permettent jamais de choisir une identité ou des données à enregistrer.

Réponses : `id`, `firstName`, `lastName`, `email`, `phone`, `isOwner`, `createdAt`,
`updatedAt`. Des alias `prenom`, `nom`, `telephone` et `owner` sont ajoutés pour
préserver le contrat Angular existant. Les noms facultatifs non renseignés
deviennent des chaînes vides uniquement dans ces alias. Le PUT accepte également
`prenom`, `nom` et `telephone` comme alias des trois champs modifiables.
Les routes et méthodes HTTP correspondent au ProfileService Angular sans changement frontend.

`sync` prend l'UUID uniquement dans le `sub` vérifié. L'e-mail provient du claim
Auth `email`, jamais des métadonnées ou du corps HTTP. Les métadonnées descriptives
`prenom`/`nom`, `first_name`/`last_name`, `given_name`/`family_name` et les variantes
Google `full_name`/`name` sont prises en charge pour la création. Elles sont
modifiables par l'utilisateur et n'accordent aucun privilège. L'insertion fixe
toujours `is_owner=false` et utilise `ON CONFLICT (id) DO NOTHING`. La synchronisation
verrouille ensuite le profil et complète uniquement les noms et l'e-mail vides.
Le téléphone est complété uniquement si le profil n'a encore jamais été modifié
(`created_at = updated_at`), pour préserver un effacement volontaire.
Les informations déjà renseignées et le statut propriétaire sont conservés.
Les opérations de modification et d'activation verrouillent la ligne dans une
transaction, pour éviter notamment de perdre une activation concurrente.

## Sécurité et erreurs

Spring Security valide la signature via le JWKS, exclusivement avec ES256, puis
l'issuer, l'expiration et `nbf` lorsqu'il existe (tolérance standard de 60 secondes),
la présence de `exp` et `iat`, l'audience `authenticated`, le rôle `authenticated`,
un `sub` UUID et un `session_id` UUID. Les sessions anonymes, jetons symétriques,
tokens mal signés et clés publishable/service_role sont refusés. Le JWKS est chargé
et mis en cache par Nimbus ; aucune clé secrète de signature n'est requise.
La rotation des clés et la validation utilisent le Resource Server standard.

L'API est stateless et utilise uniquement Authorization Bearer. CSRF est désactivé
pour cette API sans authentification par cookie. Les rôles des métadonnées ne sont
jamais utilisés ; le statut propriétaire provient de PostgreSQL.

CORS autorise `http://localhost:4200` (variable `FRONTEND_URL`), GET, POST, PUT,
OPTIONS et les en-têtes Authorization, Content-Type et Accept. Les préflights
fonctionnent sans JWT ; les autres origines, méthodes et en-têtes sont refusés.

Les erreurs JSON contiennent `timestamp`, `status`, `code`, `message`, `path` et
`fieldErrors`. Le chemin est vide pour un refus CORS intervenant avant MVC.
400 : requête invalide ; 401 : token absent/invalide ; 403 : accès/CORS refusé ;
404 : profil absent (appeler sync) ; 409 : conflit d'intégrité ou concurrence ;
500 : erreur interne générique. Les détails SQL, traces et jetons ne sont pas renvoyés.

## Vérifier sans secret

```powershell
mvn -B -ntp clean verify
```

Les tests MVC utilisent des JWT ES256 signés pour les tests et un JWKS HTTP local.
Ils exercent le vrai décodeur et la chaîne Spring Security sans PostgreSQL, sans
réseau Supabase et sans token réel. Les tests de service vérifient la sélection par
identité, la synchronisation, les noms Google, les champs modifiables et l'activation.

Avec les secrets locaux, restent à vérifier : démarrage JDBC SSL, validation du
schéma existant, droits du rôle serveur avec RLS, exécution PostgreSQL de l'upsert
et des verrous sous concurrence, et les parcours Angular avec de vrais JWT du projet.
Ces tests isolés ne prouvent pas la connectivité ou les privilèges de la base réelle.
