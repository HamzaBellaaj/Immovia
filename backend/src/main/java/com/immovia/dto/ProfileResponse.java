package com.immovia.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.immovia.entity.Profile;
import java.time.Instant;
import java.util.UUID;

public record ProfileResponse(UUID id, String firstName, String lastName, String email,
                              String phone, @JsonProperty("isOwner") boolean isOwner,
                              Instant createdAt, Instant updatedAt) {
    public static ProfileResponse from(Profile profile) {
        return new ProfileResponse(profile.getId(), profile.getFirstName(), profile.getLastName(),
                profile.getEmail(), profile.getPhone(), profile.isOwner(),
                profile.getCreatedAt(), profile.getUpdatedAt());
    }

    // Compatibilite avec le frontend existant, sans exposer l'entite JPA.
    @JsonProperty("prenom") public String legacyFirstName() { return firstName == null ? "" : firstName; }
    @JsonProperty("nom") public String legacyLastName() { return lastName == null ? "" : lastName; }
    @JsonProperty("telephone") public String legacyPhone() { return phone; }
    @JsonProperty("owner") public boolean legacyOwner() { return isOwner; }
}
