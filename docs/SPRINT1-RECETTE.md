# Checklist de recette — Sprint 1

Les cases cochées correspondent aux vérifications réellement exécutées.
Les tests avec doubles réseau ne valident pas les services distants.

## Automatisé et livrables

- [x] Build Angular de production réussi.
- [x] Build Maven et 31 tests backend réussis.
- [x] 13 scénarios navigateur avec doubles réseau réussis, sans erreur JavaScript.
- [x] Vrai Tomcat de test sur port libre : Health 200, routes privées 401, OPTIONS CORS accepté.
- [x] Signature ES256/JWKS, expiration, issuer, audience et identité vérifiés par les tests de sécurité.
- [x] Champs protégés refusés par PUT ; sélection du profil par le seul sub dans les tests.
- [x] DTO canonique Spring vérifié et adapté par Angular ; champs du PUT alignés.
- [x] Limites de validation frontend/backend alignées.
- [x] Callbacks PKCE et implicites de récupération testés avec doubles Supabase.
- [x] Formulaire de récupération inaccessible avec une simple session ordinaire ou sans contexte valide.
- [x] Erreurs backend et DTO incompatibles visibles, sans faux profil ni faux succès.
- [x] Comparaison visuelle, logo/assets et responsive ; icônes de navigation rapprochées des maquettes.
- [x] Collection Postman, environnement vide, assertions et procédure de token créés.
- [x] JSON Postman et syntaxe des scripts validés ; aucun token réel dans les livrables.
- [x] Configuration publique Supabase consultée : Google/e-mail actifs, confirmation obligatoire, JWKS ES256.
- [x] Audit npm de production : aucune vulnérabilité signalée.
- [x] Maquettes inchangées (10 fichiers, empreintes SHA-256).

## Configuration locale et services réels — à effectuer

- [ ] Définir le vrai DB_PASSWORD dans le terminal/IDE.
- [ ] Résoudre le conflit Oracle sur 8080 ou utiliser 8081 dans backend, Angular et Postman.
- [ ] Démarrer Spring Boot avec la connexion PostgreSQL réelle et vérifier ddl-auto=validate.
- [ ] Vérifier les privilèges serveur malgré RLS, sans modifier les privilèges des clients.
- [ ] Vérifier Site URL et Redirect URLs dans Supabase sans changer SMTP ni secrets.
- [ ] Inscrire le compte A ; recevoir l'e-mail et confirmer le compte.
- [ ] Vérifier le refus de connexion avant confirmation.
- [ ] Se connecter avec le mot de passe puis avec Google réellement.
- [ ] Créer/lire le profil en base via Sync ; vérifier son UUID Auth.
- [ ] Modifier prénom, nom et téléphone ; contrôler SQL et persistance après rafraîchissement/reconnexion.
- [ ] Activer propriétaire ; contrôler is_owner=true en base et répéter sans erreur.
- [ ] Recevoir un vrai e-mail de récupération ; cliquer ConfirmationURL dans le navigateur d'origine.
- [ ] Vérifier l'arrivée sur nouveau-mot-de-passe puis modifier réellement le mot de passe.
- [ ] Vérifier l'ancien mot de passe refusé, le nouveau accepté et un lien réutilisé/expiré refusé.
- [ ] Exécuter la collection Postman contre l'API et PostgreSQL réels avec un token local.
- [ ] Vérifier les refus sans token, avec token invalide et avec un vrai token expiré.
- [ ] Utiliser B pour vérifier l'isolation avec les données de A, sans utiliser le token de A.
- [ ] Observer les logs pendant les parcours réels : absence de tokens et de secrets.
- [ ] Valider la concurrence réelle de Sync et des mises à jour PostgreSQL.

Compte(s) de recette : à renseigner localement, sans mot de passe ni token.
Date / responsable / observations : à compléter après exécution réelle.
