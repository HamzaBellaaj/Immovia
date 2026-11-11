package com.immovia.service;

import com.immovia.dto.ProfileResponse;
import com.immovia.dto.ProfileUpdateRequest;
import com.immovia.entity.Profile;
import com.immovia.exception.ProfileNotFoundException;
import com.immovia.repository.ProfileRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {
    private final ProfileRepository profiles;

    public ProfileService(ProfileRepository profiles) { this.profiles = profiles; }

    @Transactional
    public ProfileResponse sync(Jwt jwt) {
        UUID id = UUID.fromString(jwt.getSubject());
        Map<String, Object> metadata = jwt.getClaimAsMap("user_metadata");
        if (metadata == null) metadata = Map.of();
        String firstName = metadataText(metadata, "prenom", "first_name", "given_name");
        String lastName = metadataText(metadata, "nom", "last_name", "family_name");
        String fullName = metadataText(metadata, "full_name", "name");
        if (fullName != null) {
            String[] parts = fullName.split("\\s+", 2);
            if (firstName == null) firstName = parts[0];
            if (lastName == null && parts.length == 2) lastName = parts[1];
        }
        // Les metadonnees sont editables par l'utilisateur : uniquement des champs descriptifs.
        // L'email provient du claim d'identite, jamais de user_metadata ou du corps HTTP.
        firstName = limited(firstName, 100);
        lastName = limited(lastName, 100);
        String email = jwt.getClaimAsString("email");
        String phone = limited(metadataText(metadata, "telephone", "phone"), 30);
        profiles.insertIfAbsent(id, firstName, lastName, email, phone);
        // Un trigger Supabase peut avoir deja cree une ligne sans les noms du fournisseur.
        Profile profile = profiles.findForUpdate(id).orElseThrow(ProfileNotFoundException::new);
        profile.completeFromAuth(firstName, lastName, email, phone, Instant.now());
        return ProfileResponse.from(profile);
    }

    @Transactional(readOnly = true)
    public ProfileResponse me(Jwt jwt) { return ProfileResponse.from(find(UUID.fromString(jwt.getSubject()))); }

    @Transactional
    public ProfileResponse update(Jwt jwt, ProfileUpdateRequest request) {
        Profile profile = profiles.findForUpdate(UUID.fromString(jwt.getSubject()))
                .orElseThrow(ProfileNotFoundException::new);
        profile.updateDetails(request.firstName().strip(), request.lastName().strip(),
                blankToNull(request.phone()), Instant.now());
        return ProfileResponse.from(profile);
    }

    @Transactional
    public ProfileResponse becomeOwner(Jwt jwt) {
        Profile profile = profiles.findForUpdate(UUID.fromString(jwt.getSubject()))
                .orElseThrow(ProfileNotFoundException::new);
        profile.becomeOwner(Instant.now());
        return ProfileResponse.from(profile);
    }

    private Profile find(UUID id) { return profiles.findById(id).orElseThrow(ProfileNotFoundException::new); }

    private static String metadataText(Map<String, Object> metadata, String... names) {
        for (String name : names) {
            Object value = metadata.get(name);
            if (value instanceof String text && !text.isBlank()) return text.strip();
        }
        return null;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String limited(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(value.length(), max));
    }
}
