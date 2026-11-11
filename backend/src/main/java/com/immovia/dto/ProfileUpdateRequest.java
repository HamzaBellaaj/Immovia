package com.immovia.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Liste exhaustive des champs modifiables. Les autres proprietes JSON sont rejetees. */
public record ProfileUpdateRequest(
        @JsonAlias("prenom") @NotBlank(message = "Le prénom est obligatoire.")
        @Size(max = 100, message = "Le prénom ne doit pas dépasser 100 caractères.") String firstName,
        @JsonAlias("nom") @NotBlank(message = "Le nom est obligatoire.")
        @Size(max = 100, message = "Le nom ne doit pas dépasser 100 caractères.") String lastName,
        @JsonAlias("telephone") @Size(max = 30, message = "Le téléphone ne doit pas dépasser 30 caractères.")
        @Pattern(regexp = "^$|^\\+?[0-9 () .-]{6,30}$", message = "Le numéro de téléphone est invalide.") String phone) {
}
