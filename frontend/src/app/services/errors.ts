import { HttpErrorResponse } from '@angular/common/http';

/** Ne jamais afficher les reponses brutes : elles peuvent contenir des donnees sensibles. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'Le service de profil est injoignable. Vérifiez que le serveur est démarré et autorise cette connexion.';
    if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous.';
    if (error.status === 403) return 'Cette opération n’est pas autorisée.';
    if (error.status === 404 || error.status === 501)
      return 'Le service de profil n’est pas encore disponible. Impossible de confirmer l’opération.';
    if (error.status === 400 || error.status === 422)
      return 'Les informations ont été refusées. Vérifiez les champs du formulaire.';
    return 'Le service de profil rencontre un problème. Réessayez plus tard.';
  }
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'invalid_profile_response':
      return 'Le service de profil a renvoyé un format inattendu. Impossible de confirmer les informations.';
    case 'owner_not_confirmed':
      return 'L’activation du statut propriétaire n’a pas été confirmée par le serveur. Réessayez ou rechargez votre profil.';
    case 'invalid_credentials':
      return 'Adresse e-mail ou mot de passe incorrect.';
    case 'email_not_confirmed':
      return 'Confirmez votre adresse e-mail avant de vous connecter.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Cette adresse ne permet pas de créer un nouveau compte. Essayez de vous connecter.';
    case 'weak_password':
      return 'Le mot de passe ne respecte pas les exigences de sécurité. Utilisez au moins 8 caractères et évitez un mot de passe courant.';
    case 'same_password':
      return 'Choisissez un mot de passe différent du précédent.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'pkce_verifier_not_found':
    case 'invalid_grant':
      return 'Ce lien est expiré, déjà utilisé ou ouvert dans un autre navigateur. Demandez un nouveau lien et ouvrez-le dans le navigateur d’origine.';
    case 'access_denied':
      return 'La connexion a été annulée ou refusée.';
    default:
      return 'L’opération n’a pas abouti. Vérifiez votre connexion ou demandez un nouveau lien.';
  }
}
