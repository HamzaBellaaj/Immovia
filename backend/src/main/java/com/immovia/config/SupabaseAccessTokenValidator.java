package com.immovia.config;

import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/** Controle des claims d'un token deja verifie cryptographiquement par Nimbus. */
public final class SupabaseAccessTokenValidator implements OAuth2TokenValidator<Jwt> {
    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        boolean valid = canonicalUuid(jwt.getSubject())
                && canonicalUuid(jwt.getClaimAsString("session_id"))
                && "authenticated".equals(jwt.getClaimAsString("role"))
                && jwt.getAudience() != null && jwt.getAudience().contains("authenticated")
                && !Boolean.TRUE.equals(jwt.getClaim("is_anonymous"))
                && jwt.getExpiresAt() != null && jwt.getIssuedAt() != null
                && jwt.getIssuedAt().isBefore(jwt.getExpiresAt())
                && !jwt.getIssuedAt().isAfter(Instant.now().plusSeconds(60));
        if (valid) return OAuth2TokenValidatorResult.success();
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Invalid access token claims", null));
    }

    private static boolean canonicalUuid(String value) {
        if (value == null) return false;
        try { return UUID.fromString(value).toString().equalsIgnoreCase(value); }
        catch (IllegalArgumentException exception) { return false; }
    }
}
