package com.immovia.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.immovia.dto.ProfileUpdateRequest;
import com.immovia.entity.Profile;
import com.immovia.exception.ProfileNotFoundException;
import com.immovia.repository.ProfileRepository;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;

class ProfileServiceTest {
    private final ProfileRepository repository = mock(ProfileRepository.class);
    private final ProfileService service = new ProfileService(repository);
    private final UUID id = UUID.randomUUID();
    private Profile profile;

    @BeforeEach void setup() {
        profile = BeanUtils.instantiateClass(Profile.class);
        ReflectionTestUtils.setField(profile, "id", id);
        ReflectionTestUtils.setField(profile, "firstName", "Prénom édité");
        ReflectionTestUtils.setField(profile, "lastName", "Nom édité");
        ReflectionTestUtils.setField(profile, "email", "identity@example.com");
        ReflectionTestUtils.setField(profile, "phone", "+216 22333444");
        ReflectionTestUtils.setField(profile, "createdAt", Instant.parse("2026-01-01T00:00:00Z"));
        ReflectionTestUtils.setField(profile, "updatedAt", profile.getCreatedAt());
    }

    @Test void syncUsesSubjectAndIdentityEmailButNeverMetadataPrivileges() {
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        Jwt jwt = jwt(Map.of("prenom", "Amira", "nom", "Test", "telephone", "+216 11222333", "email", "forged@example.com", "is_owner", true));
        var first = service.sync(jwt);
        var second = service.sync(jwt);
        verify(repository, times(2)).insertIfAbsent(id, "Amira", "Test", "identity@example.com", "+216 11222333");
        assertThat(first).isEqualTo(second);
        assertThat(first.firstName()).isEqualTo("Prénom édité");
        assertThat(first.isOwner()).isFalse();
        verify(repository, never()).save(any());
    }

    @Test void syncUnderstandsGoogleNamesAndMissingMetadata() {
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        service.sync(jwt(Map.of("given_name", "Amira", "family_name", "Google")));
        verify(repository).insertIfAbsent(id, "Amira", "Google", "identity@example.com", null);
        service.sync(jwt(Map.of("full_name", "Amira Nom Composé")));
        verify(repository).insertIfAbsent(id, "Amira", "Nom Composé", "identity@example.com", null);
        service.sync(jwt(Map.of()));
        verify(repository).insertIfAbsent(id, null, null, "identity@example.com", null);
    }

    @Test void syncCompletesAnExistingEmptyProfileFromSignupMetadataAndIsIdempotent() {
        ReflectionTestUtils.setField(profile, "firstName", null);
        ReflectionTestUtils.setField(profile, "lastName", "  ");
        ReflectionTestUtils.setField(profile, "email", null);
        ReflectionTestUtils.setField(profile, "phone", null);
        ReflectionTestUtils.setField(profile, "owner", true);
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        Jwt jwt = jwt(Map.of("prenom", "Amira", "nom", "Test", "telephone", "+216 11222333"));
        var first = service.sync(jwt);
        var second = service.sync(jwt);
        assertThat(first.firstName()).isEqualTo("Amira");
        assertThat(first.lastName()).isEqualTo("Test");
        assertThat(first.email()).isEqualTo("identity@example.com");
        assertThat(first.phone()).isEqualTo("+216 11222333");
        assertThat(first.isOwner()).isTrue();
        assertThat(second).isEqualTo(first);
    }

    @Test void syncCompletesGoogleNamesButKeepsEditedNamesAndAnIntentionallyClearedPhone() {
        ReflectionTestUtils.setField(profile, "firstName", null);
        ReflectionTestUtils.setField(profile, "lastName", null);
        ReflectionTestUtils.setField(profile, "phone", null);
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        var google = service.sync(jwt(Map.of("full_name", "Amira Nom Compose")));
        assertThat(google.firstName()).isEqualTo("Amira");
        assertThat(google.lastName()).isEqualTo("Nom Compose");
        profile.updateDetails("Prenom choisi", "Nom choisi", null, Instant.now());
        var edited = service.sync(jwt(Map.of("given_name", "Autre", "family_name", "Google",
                "phone", "+216 11222333")));
        assertThat(edited.firstName()).isEqualTo("Prenom choisi");
        assertThat(edited.lastName()).isEqualTo("Nom choisi");
        assertThat(edited.phone()).isNull();
    }

    @Test void syncHandlesMissingAndMalformedMetadataWithoutInventingNames() {
        ReflectionTestUtils.setField(profile, "firstName", null);
        ReflectionTestUtils.setField(profile, "lastName", null);
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        var empty = service.sync(jwt(Map.of("given_name", 123, "family_name", "  ")));
        assertThat(empty.firstName()).isNull();
        assertThat(empty.lastName()).isNull();
        var single = service.sync(jwt(Map.of("name", "Amira")));
        assertThat(single.firstName()).isEqualTo("Amira");
        assertThat(single.lastName()).isNull();
    }

    @Test void readsAndWritesOnlyTheSubjectProfile() {
        when(repository.findById(id)).thenReturn(Optional.of(profile));
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        assertThat(service.me(jwt(Map.of())).id()).isEqualTo(id);
        service.update(jwt(Map.of()), new ProfileUpdateRequest("  Amira  ", "  Test  ", ""));
        assertThat(profile.getFirstName()).isEqualTo("Amira");
        assertThat(profile.getLastName()).isEqualTo("Test");
        assertThat(profile.getPhone()).isNull();
        assertThat(profile.getEmail()).isEqualTo("identity@example.com");
        assertThat(profile.isOwner()).isFalse();
        assertThat(profile.getUpdatedAt()).isAfter(profile.getCreatedAt());
        verify(repository).findById(id);
        verify(repository).findForUpdate(id);
        verifyNoMoreInteractions(repository);
    }

    @Test void ownerActivationIsIdempotentAndCannotBeRevertedByDetailsUpdate() {
        when(repository.findForUpdate(id)).thenReturn(Optional.of(profile));
        var first = service.becomeOwner(jwt(Map.of()));
        var second = service.becomeOwner(jwt(Map.of()));
        assertThat(first.isOwner()).isTrue();
        assertThat(second.updatedAt()).isEqualTo(first.updatedAt());
        service.update(jwt(Map.of()), new ProfileUpdateRequest("Amira", "Test", null));
        assertThat(profile.isOwner()).isTrue();
        assertThat(profile.getCreatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test void missingProfileIsExplicitAndAnotherUserDoesNotSelectAnExistingProfile() {
        UUID other = UUID.randomUUID();
        Jwt otherJwt = Jwt.withTokenValue("service-unit-test-only").header("alg", "ES256").subject(other.toString()).build();
        when(repository.findById(other)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.me(otherJwt)).isInstanceOf(ProfileNotFoundException.class);
        verify(repository).findById(other);
        verify(repository, never()).findById(id);
    }

    private Jwt jwt(Map<String, Object> metadata) {
        return Jwt.withTokenValue("service-unit-test-only").header("alg", "ES256").subject(id.toString())
                .claim("email", "identity@example.com").claim("user_metadata", metadata).build();
    }
}
