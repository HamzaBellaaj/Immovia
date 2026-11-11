/** DTO REST canonique retourne par Spring Boot. */
export interface ProfileDto {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Modele d'affichage utilise par les formulaires en francais. */
export interface Profile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  owner: boolean;
}

export interface ProfileUpdate {
  prenom: string;
  nom: string;
  telephone: string;
}
