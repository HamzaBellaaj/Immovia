package com.immovia.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.immovia.controller.HealthController;
import com.immovia.controller.ProfileController;
import com.immovia.dto.ProfileResponse;
import com.immovia.dto.ProfileUpdateRequest;
import com.immovia.exception.ProfileNotFoundException;
import com.immovia.service.ProfileService;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.ECKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** Requetes HTTP avec verification reelle ES256/JWKS, sans base ni token Supabase reel. */
@WebMvcTest(controllers = {HealthController.class, ProfileController.class}, properties = "debug=false")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import(SecurityConfig.class)
class ApiSecurityTest {
    private static final String ISSUER = "https://test.supabase.invalid/auth/v1";
    private static final UUID USER_ID = UUID.fromString("dbbbd161-d9db-4107-a29b-0a16bf462d29");
    private static final ECKey KEY;
    private static final HttpServer JWKS;
    static {
        try {
            KEY = new ECKeyGenerator(Curve.P_256).keyID("test-only-key").algorithm(JWSAlgorithm.ES256).generate();
            JWKS = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            byte[] publicKeys = new JWKSet(KEY.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
            JWKS.createContext("/jwks", exchange -> {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, publicKeys.length);
                try (var output = exchange.getResponseBody()) { output.write(publicKeys); }
            });
            JWKS.start();
        } catch (Exception exception) { throw new ExceptionInInitializerError(exception); }
    }

    @Autowired MockMvc mvc;
    @MockitoBean ProfileService profiles;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri", () -> ISSUER);
        registry.add("spring.security.oauth2.resourceserver.jwt.jwk-set-uri", () -> "http://127.0.0.1:" + JWKS.getAddress().getPort() + "/jwks");
    }

    @AfterAll static void stopJwks() { JWKS.stop(0); }

    @Test void healthIsPublicAndStateless() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test void allProfileEndpointsRequireBearer() throws Exception {
        for (var request : List.of(get("/api/profile/me"), post("/api/profile/sync"),
                put("/api/profile/me"), post("/api/profile/become-owner"))) {
            mvc.perform(request).andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("unauthorized"))
                    .andExpect(header().string("WWW-Authenticate", "Bearer"));
        }
    }

    static Stream<Consumer<JWTClaimsSet.Builder>> invalidClaims() {
        return Stream.of(
                claims -> claims.issuer("https://another-project.invalid/auth/v1"),
                claims -> claims.audience("anon"),
                claims -> claims.audience(List.of()),
                claims -> claims.expirationTime(Date.from(Instant.now().minusSeconds(120))),
                claims -> claims.expirationTime(null),
                claims -> claims.issueTime(null),
                claims -> claims.notBeforeTime(Date.from(Instant.now().plusSeconds(600))),
                claims -> claims.issueTime(Date.from(Instant.now().plusSeconds(600))),
                claims -> claims.subject("not-a-uuid"),
                claims -> claims.subject("1-1-1-1-1"),
                claims -> claims.claim("role", "service_role"),
                claims -> claims.claim("session_id", null),
                claims -> claims.claim("is_anonymous", true));
    }

    @ParameterizedTest @MethodSource("invalidClaims")
    void rejectsInvalidAccessTokenClaims(Consumer<JWTClaimsSet.Builder> change) throws Exception {
        mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + token(change)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @Test void rejectsWrongSignatureMalformedAndSymmetricTokens() throws Exception {
        SignedJWT forged = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(KEY.getKeyID()).type(JOSEObjectType.JWT).build(), claims().build());
        forged.sign(new ECDSASigner(new ECKeyGenerator(Curve.P_256).generate()));
        SignedJWT symmetric = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims().build());
        symmetric.sign(new MACSigner(new byte[32]));
        for (String invalid : List.of(forged.serialize(), symmetric.serialize(), "not-a-token")) {
            mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + invalid))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.status").value(401));
        }
    }

    @Test void validJwtReturnsCanonicalAndAngularFields() throws Exception {
        when(profiles.me(any())).thenReturn(response(false));
        mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + token(claims -> claims.audience(List.of("other", "authenticated")))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(USER_ID.toString()))
                .andExpect(jsonPath("$.firstName").value("Amira")).andExpect(jsonPath("$.lastName").value("Test"))
                .andExpect(jsonPath("$.isOwner").value(false)).andExpect(jsonPath("$.owner").value(false))
                .andExpect(jsonPath("$.prenom").value("Amira")).andExpect(jsonPath("$.telephone").value("+216 22333444"))
                .andExpect(jsonPath("$.createdAt").exists()).andExpect(jsonPath("$.updatedAt").exists())
                .andExpect(jsonPath("$.access_token").doesNotExist());
    }

    @Test void syncUsesAuthenticatedSubjectAndIgnoresClientSelectedIdentity() throws Exception {
        when(profiles.sync(any())).thenReturn(response(false));
        mvc.perform(post("/api/profile/sync").header("Authorization", "Bearer " + token(c -> { }))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"id\":\"00000000-0000-0000-0000-000000000001\",\"isOwner\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isOwner").value(false));
        ArgumentCaptor<Jwt> jwt = ArgumentCaptor.forClass(Jwt.class);
        verify(profiles).sync(jwt.capture());
        assertThat(jwt.getValue().getSubject()).isEqualTo(USER_ID.toString());
    }

    @Test void updatesAcceptCanonicalAndLegacyNames() throws Exception {
        when(profiles.update(any(), any())).thenReturn(response(false));
        for (String body : List.of("{\"firstName\":\"Amira\",\"lastName\":\"Test\",\"phone\":\"+216 22333444\"}",
                "{\"prenom\":\"Amira\",\"nom\":\"Test\",\"telephone\":\"+216 22333444\"}")) {
            mvc.perform(put("/api/profile/me").header("Authorization", "Bearer " + token(c -> { }))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        }
        verify(profiles, org.mockito.Mockito.times(2)).update(any(), org.mockito.ArgumentMatchers.eq(new ProfileUpdateRequest("Amira", "Test", "+216 22333444")));
    }

    @Test void refusesMassAssignmentAndInvalidData() throws Exception {
        for (String forbidden : List.of("id", "email", "isOwner", "owner", "createdAt", "updatedAt")) {
            mvc.perform(put("/api/profile/me").header("Authorization", "Bearer " + token(c -> { }))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"firstName\":\"Amira\",\"lastName\":\"Test\",\"" + forbidden + "\":true}"))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("invalid_request"));
        }
        mvc.perform(put("/api/profile/me").header("Authorization", "Bearer " + token(c -> { }))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"firstName\":\" \",\"lastName\":\"Test\",\"phone\":\"invalid\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.firstName").exists())
                .andExpect(jsonPath("$.fieldErrors.phone").exists());
        org.mockito.Mockito.verifyNoInteractions(profiles);
    }

    @Test void activationReturnsOwnerStatus() throws Exception {
        when(profiles.becomeOwner(any())).thenReturn(response(true));
        mvc.perform(post("/api/profile/become-owner").header("Authorization", "Bearer " + token(c -> { }))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.isOwner").value(true)).andExpect(jsonPath("$.owner").value(true));
    }

    @Test void corsPreflightAllowsAngularAndRejectsOtherOriginsOrMethodsInJson() throws Exception {
        mvc.perform(options("/api/profile/me").header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "PUT").header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
        mvc.perform(options("/api/profile/me").header("Origin", "https://untrusted.invalid").header("Access-Control-Request-Method", "PUT"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("cors_forbidden"));
        mvc.perform(options("/api/profile/me").header("Origin", "http://localhost:4200").header("Access-Control-Request-Method", "DELETE"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.status").value(403));
        mvc.perform(get("/api/profile/me").header("Origin", "http://localhost:4200"))
                .andExpect(status().isUnauthorized()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
    }

    @Test void applicationErrorsAreJsonAndDoNotLeakExceptions() throws Exception {
        when(profiles.me(any())).thenThrow(new ProfileNotFoundException());
        mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + token(c -> { })))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("profile_not_found"));
        org.mockito.Mockito.doThrow(new DataIntegrityViolationException("private-database-detail")).when(profiles).me(any());
        mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + token(c -> { })))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("profile_conflict"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-database-detail"))));
        org.mockito.Mockito.doThrow(new RuntimeException("private-token-detail")).when(profiles).me(any());
        mvc.perform(get("/api/profile/me").header("Authorization", "Bearer " + token(c -> { })))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("internal_error"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private-token-detail"))));
    }

    private static ProfileResponse response(boolean owner) {
        return new ProfileResponse(USER_ID, "Amira", "Test", "amira@example.com", "+216 22333444", owner, Instant.now(), Instant.now());
    }
    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().issuer(ISSUER).subject(USER_ID.toString()).audience("authenticated")
                .issueTime(Date.from(Instant.now().minusSeconds(10))).expirationTime(Date.from(Instant.now().plusSeconds(600)))
                .claim("role", "authenticated").claim("session_id", UUID.randomUUID().toString()).claim("is_anonymous", false);
    }
    private static String token(Consumer<JWTClaimsSet.Builder> change) throws Exception {
        JWTClaimsSet.Builder claims = claims(); change.accept(claims);
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(KEY.getKeyID()).type(JOSEObjectType.JWT).build(), claims.build());
        jwt.sign(new ECDSASigner(KEY));
        return jwt.serialize();
    }
}
