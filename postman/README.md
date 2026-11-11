# Postman — recette du Sprint 1

Importer `Immovia-Sprint1.postman_collection.json` et
`Immovia-Local.postman_environment.json`, puis sélectionner cet environnement.
`base_url` vaut `http://localhost:8080`. Ne pas utiliser le listener Oracle déjà
présent sur ce port comme s'il s'agissait de l'API Immovia : Health doit retourner
un JSON avec `application: immovia-backend`.

## Obtenir un véritable access token

1. Démarrer Angular et Spring Boot avec la base configurée.
2. Se connecter sur http://localhost:4200/connexion avec un compte de recette
   dont l'adresse est confirmée, ou avec Google.
3. Ouvrir les outils de développement du navigateur, onglet **Network**, et
   recharger `/profil`. Sélectionner `POST /api/profile/sync` ou `GET /api/profile/me`.
4. Copier uniquement la valeur après `Bearer ` de l'en-tête Authorization.
   Elle est aussi disponible dans **Application → Local Storage →
   http://localhost:4200 → sb-koihgmmtxqlbuexewurx-auth-token**, propriété `access_token`.
5. Dans Postman, renseigner la **valeur locale** de `access_token`, marquée sensible.
   Ne pas la partager, la synchroniser dans le cloud ou exporter un environnement
   contenant ce token. L'environnement livré reste vide. Si un export local est
   indispensable, utiliser un nom se terminant par `.local.json` (ignoré par Git).

Un publishable key n'est pas un access token utilisateur. Ne pas employer de clé
service_role. Quand le jeton expire, se reconnecter/rafraîchir Angular et le recopier.
La déconnexion Supabase révoque les refresh tokens concernés ; un access token déjà
émis peut rester valide jusqu'à son expiration dans une API à validation JWT stateless.

## Exécuter la collection

Utiliser **Run collection** dans l'ordre fourni. Cette recette modifie le compte
de test : prénom/nom/téléphone puis activation propriétaire. Ne pas l'exécuter sur
un compte à conserver intact. Les requêtes privées s'arrêtent avant envoi si le
token n'est pas renseigné ; cela ne constitue pas un succès de recette.

La collection comprend Health, Sync, lecture, modification, activation,
répétition de l'activation, lecture sans JWT, lecture avec JWT invalide et tentative
de modification directe de `isOwner` par PUT. Les assertions attendent les codes
200/400/401 appropriés, le contrat JSON, l'identité stable au sein du Runner et le
statut propriétaire confirmé. Aucun test ne se contente d'accepter n'importe quel 2xx.

Pour un jeton expiré : remplacer temporairement la valeur locale par un véritable
access token de test expiré depuis plus de 60 secondes et envoyer GET My Profile ;
vérifier manuellement 401. Ne pas fabriquer sa propre signature ni modifier le payload
d'un JWT réel pour prétendre avoir testé l'expiration.

Pour l'isolation : faire Sync et GET avec un utilisateur A, puis avec B ; vérifier
des UUID distincts. Avec le token B, envoyer un identifiant A dans le corps de Sync
ou comme query param de GET me : le résultat doit rester B. GET
`/api/profile/<UUID-de-A>` doit être indisponible (aucun endpoint de lecture par ID).
La copie d'un JWT de A authentifierait A : ne pas confondre ce cas avec l'isolation.

Après PUT et activation, relire le profil, recharger Angular et vérifier dans
Supabase SQL Editor (sans modifier les politiques) :

```sql
SELECT id, first_name, last_name, phone, is_owner, created_at, updated_at
FROM public.profiles
WHERE id = '<UUID du compte de recette>'::uuid;
```

## Vérification locale des livrables

Depuis la racine : `node postman/validate.cjs`. Cette commande vérifie les JSON,
la présence des assertions et leur syntaxe ; elle **n'exécute pas** les requêtes
contre une API réelle. L'exécution complète Postman nécessite la connexion
PostgreSQL et un vrai jeton utilisateur et reste à faire dans cet environnement.
