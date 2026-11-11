# Rapport d'intégration du Sprint 1 — 7 novembre 2026

## A. Fonctionnalités terminées dans le code

Les huit pages Angular et l'authentification Supabase sont implémentées : inscription
avec confirmation obligatoire, connexion, OAuth Google, déconnexion, demande de
récupération, traitement du lien et changement de mot de passe, profil et activation
propriétaire. Le frontend conserve les styles/assets des maquettes.

Le backend fournit Health et les quatre routes privées de profil, avec validation
ES256/JWKS, issuer, dates, audience, rôle et identité. JPA cible la table existante
avec SSL et validation de schéma ; aucune migration ni règle RLS n'est modifiée.

L'étape d'intégration a ajouté un DTO TypeScript canonique et son adaptateur vers
les formulaires français, des payloads PUT canoniques, les mêmes limites de validation
que le backend et la remise à zéro d'une ancienne erreur de callback après une
nouvelle authentification/inscription réussie. Les icônes de navigation utilisent
désormais les SVG des maquettes. Les alias backend historiques restent compatibles.

Livrables ajoutés : tests navigateur reproductibles, tests HTTP de démarrage,
collection Postman à neuf requêtes, environnement sans token, validation des JSON,
documentation et checklist. Aucun sprint supplémentaire n'a été commencé.

## B. Builds et contrôles exécutés

| Contrôle | Résultat et portée |
| --- | --- |
| `npm --prefix frontend run build` | Réussi, aucun avertissement de budget |
| `mvn -B -ntp -f backend/pom.xml clean verify` | BUILD SUCCESS, JAR produit ; 31 tests, 0 échec/erreur |
| Tests MVC/sécurité | 23 tests : JWT ES256 signés pour les tests et JWKS HTTP local, erreurs, CORS, champs interdits et contrat JSON |
| Tests service | 5 tests : identité, métadonnées, champs modifiables, idempotence propriétaire et absence de profil |
| Tests HTTP | 3 tests : vrai Tomcat lancé sur un port attribué automatiquement (49601 lors de l'exécution), Health 200, token absent/invalide 401, préflight CORS 200 ; repository remplacé dans ce test |
| `npm --prefix frontend run test:browser` | 13 scénarios réussis sous Edge, aucune erreur JavaScript ; build Angular servi sur 4200, Auth et API simulées uniquement dans les tests |
| `node postman/validate.cjs` | 9 requêtes, JSON et scripts syntaxiquement valides, access_token livré vide ; aucune requête Postman réelle exécutée |
| Audit `npm audit --omit=dev` | 0 vulnérabilité de production signalée |
| Paramètres publics Supabase | Auth e-mail et Google actifs, inscription autorisée, autoconfirm=false ; JWKS EC/P-256/ES256 accessible |
| Maquettes | 10 fichiers inchangés, comparaison SHA-256 |

Les scénarios navigateur couvrent les routes publiques/protégées, validations,
inscription sans session avant confirmation, refus de connexion, sync puis GET avec
Bearer, payload PUT canonique, rechargement du profil, activation et déconnexion,
backend absent, récupération neutre, confirmation implicite, OAuth PKCE, génération
de l'URL Google, refus de récupération avec session ordinaire, DTO invalide,
PASSWORD_RECOVERY avec rechargement/updateUser, fragments reçus à la racine et lien
expiré. Les mutations sont exercées sur des réponses réseau de test : aucune
persistance SQL réelle ni interaction externe humaine n'est revendiquée.

Les captures ordinateur/mobile sont dans `frontend/test-results/` et incluent la
connexion de référence. Couleurs, fond, logo, images, typographie et dispositions
principales sont conservés ; les messages propres aux prototypes sont remplacés
par les informations des parcours réels.

## C. Parcours non vérifiés sur les services réels

Le vrai mot de passe PostgreSQL n'est pas disponible dans les variables du processus
et aucun fichier `.env` local n'est présent. Aucun accès à une boîte e-mail ou compte
Google de recette n'a été fourni/utilisé. Restent donc : JDBC SSL, schéma/privilèges
RLS réels, upsert/verrous concurrents, écritures et relectures PostgreSQL, livraison
SMTP, confirmation par clic, OAuth humain et changement réel du mot de passe.
La collection Postman n'a pas été exécutée avec un vrai token utilisateur.

Les règles d'isolation ont des tests unitaires/MVC, mais leur recette avec deux
comptes et la base Supabase réelle reste à faire. L'absence de secrets dans les
sources/configurations et les réponses de test ne vaut pas observation des logs
d'un parcours réel non exécuté.

## D. Actions manuelles exactes

1. Dans Supabase Authentication → URL Configuration, vérifier Site URL
   `http://localhost:4200` et Redirect URLs `http://localhost:4200/**` pour le développement.
   Garder les templates utilisant `<a href="{{ .ConfirmationURL }}">…</a>`.
   Le code demande `/auth/callback`, traite les retours même à la racine et achemine
   PASSWORD_RECOVERY vers `/nouveau-mot-de-passe`. Aucun changement de template n'est
   identifié comme nécessaire, mais un vrai clic de récupération reste à tester.
2. Fournir le vrai DB_PASSWORD avec la saisie PowerShell masquée ci-dessous.
3. Conserver Oracle et utiliser 8081, ou libérer 8080 après vérification de l'usage
   de ce service ; ne pas le supprimer/arrêter automatiquement.
4. Importer les deux JSON Postman, renseigner `base_url` selon le port et copier un
   access token après authentification réelle dans sa seule valeur locale.
5. Exécuter et cocher la [recette complète](SPRINT1-RECETTE.md).

## E. Problèmes et limites

- Le port 8080 appartient au listener Oracle TNSLSNR (PID 4800 au moment du contrôle).
  Les appels Health et Profile sur ce port ont renvoyé une page HTML 404, pas une
  réponse Immovia. Ce processus n'a pas été arrêté ni modifié.
- Sans DB_PASSWORD réel, l'application complète n'a pas été démarrée contre Supabase.
- L'installation npm signale 16 vulnérabilités modérées dans l'outillage de développement ;
  l'audit de production est vide. Aucune mise à jour forcée ou majeure n'a été appliquée.
- La compilation des tests HTTP signale l'utilisation de Map génériques non typées ;
  Mockito signale l'attachement dynamique de son agent sous Java 21. Aucun de ces
  avertissements n'empêche les tests ou le build et ils ne concernent pas les secrets.

## F. Démarrer sur ce poste sans arrêter Oracle

Terminal backend à la racine :

```powershell
$env:SERVER_PORT = '8081'
$databaseSecret = Read-Host 'Vrai mot de passe PostgreSQL' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
Remove-Variable databaseSecret
mvn -f backend/pom.xml spring-boot:run
# Après arrêt : Remove-Item Env:DB_PASSWORD
```

Terminal frontend à la racine :

```powershell
$env:API_BASE_URL = 'http://localhost:8081'
npm --prefix frontend ci
npm --prefix frontend start
```

Ouvrir http://localhost:4200/connexion et vérifier
http://localhost:8081/api/health. Mettre `base_url=http://localhost:8081` dans Postman.
Les autres variables publiques/DB ont les valeurs par défaut documentées dans les
`.env.example` ; le serveur ne charge pas automatiquement un fichier `.env`.
