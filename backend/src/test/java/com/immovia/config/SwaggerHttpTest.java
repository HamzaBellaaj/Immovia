package com.immovia.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.immovia.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Vrai serveur et vraie generation springdoc ; aucun secret ni acces PostgreSQL. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "debug=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
})
@ActiveProfiles({"supabase", "dev"})
class SwaggerHttpTest {
    @Autowired TestRestTemplate http;
    @MockitoBean ProfileRepository repository;

    @Test void swaggerUiAndItsResourcesArePublicInDevelopment() {
        var ui = http.getForEntity("/swagger-ui/index.html", String.class);
        assertThat(ui.getStatusCode().value()).isEqualTo(200);
        assertThat(ui.getBody()).contains("swagger-ui-bundle.js", "swagger-initializer.js");
        var entry = http.getForEntity("/swagger-ui.html", String.class);
        assertThat(entry.getStatusCode().value()).isBetween(200, 399);
        var script = http.getForEntity("/swagger-ui/swagger-initializer.js", String.class);
        assertThat(script.getStatusCode().value()).isEqualTo(200);
        assertThat(script.getBody()).contains("/v3/api-docs/swagger-config");
        assertThat(http.getForEntity("/swagger-ui/swagger-ui-bundle.js", String.class)
                .getStatusCode().value()).isEqualTo(200);
        var config = http.getForEntity("/v3/api-docs/swagger-config", JsonNode.class);
        assertThat(config.getStatusCode().value()).isEqualTo(200);
        assertThat(config.getBody().path("url").asText()).isEqualTo("/v3/api-docs");
        assertThat(config.getBody().path("persistAuthorization").asBoolean()).isFalse();
    }

    @Test void openApiDocumentsExistingOperationsAndSupabaseBearer() {
        var response = http.getForEntity("/v3/api-docs", JsonNode.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        JsonNode document = response.getBody();
        assertThat(document.path("info").path("title").asText()).isEqualTo("Immovia API");
        JsonNode scheme = document.at("/components/securitySchemes/supabaseBearer");
        assertThat(scheme.path("type").asText()).isEqualTo("http");
        assertThat(scheme.path("scheme").asText()).isEqualTo("bearer");
        assertThat(scheme.path("bearerFormat").asText()).isEqualTo("JWT");
        JsonNode paths = document.path("paths");
        assertThat(paths.size()).isEqualTo(4);
        for (String[] operation : new String[][]{{"/api/profile/sync", "post"},
                {"/api/profile/me", "get"}, {"/api/profile/me", "put"},
                {"/api/profile/become-owner", "post"}}) {
            JsonNode endpoint = paths.path(operation[0]).path(operation[1]);
            assertThat(endpoint.isMissingNode()).isFalse();
            assertThat(endpoint.path("security").get(0).has("supabaseBearer")).isTrue();
            assertThat(endpoint.path("parameters").size()).isZero();
        }
        assertThat(paths.path("/api/health").path("get").path("security").size()).isZero();
        assertThat(http.getForEntity("/v3/api-docs.yaml", String.class).getStatusCode().value())
                .isEqualTo(200);
    }

    @Test void businessEndpointsStillRejectRequestsWithoutJwt() {
        var denied = http.getForEntity("/api/profile/me", JsonNode.class);
        assertThat(denied.getStatusCode().value()).isEqualTo(401);
        assertThat(denied.getHeaders().getFirst("WWW-Authenticate")).isEqualTo("Bearer");
        assertThat(denied.getBody().path("code").asText()).isEqualTo("unauthorized");
        assertThat(http.postForEntity("/api/profile/sync", null, String.class).getStatusCode().value())
                .isEqualTo(401);
        assertThat(http.postForEntity("/api/profile/become-owner", null, String.class).getStatusCode().value())
                .isEqualTo(401);
    }

    @Test void healthRemainsPublicAndInvalidTokensAndForbiddenOriginsKeepTheirErrors() {
        assertThat(http.getForEntity("/api/health", String.class).getStatusCode().value()).isEqualTo(200);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("invalid-test-token");
        var invalid = http.exchange("/api/profile/me", HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
        assertThat(invalid.getStatusCode().value()).isEqualTo(401);
        assertThat(invalid.getBody().path("code").asText()).isEqualTo("unauthorized");
        HttpHeaders cors = new HttpHeaders();
        cors.setOrigin("https://not-allowed.invalid");
        cors.set("Access-Control-Request-Method", "PUT");
        var forbidden = http.exchange("/api/profile/me", HttpMethod.OPTIONS, new HttpEntity<>(cors), JsonNode.class);
        assertThat(forbidden.getStatusCode().value()).isEqualTo(403);
        assertThat(forbidden.getBody().path("code").asText()).isEqualTo("cors_forbidden");
    }
}
