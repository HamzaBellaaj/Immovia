package com.immovia.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.immovia.repository.ProfileRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.ActiveProfiles;

/** Vrai serveur HTTP sur port libre ; persistance remplacee uniquement dans ce test. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "debug=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
})
@ActiveProfiles("supabase")
class HttpSmokeTest {
    @Autowired TestRestTemplate http;
    @MockitoBean ProfileRepository repository;

    @Test void realHttpServerExposesPublicHealth() {
        var response = http.getForEntity("/api/health", Map.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsEntry("status", "UP");
    }

    @Test void realHttpRejectsMissingAndInvalidTokens() {
        for (String token : new String[]{"", "Bearer invalid-test-token"}) {
            HttpHeaders headers = new HttpHeaders();
            if (!token.isEmpty()) headers.set("Authorization", token);
            var response = http.exchange("/api/profile/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            assertThat(response.getStatusCode().value()).isEqualTo(401);
            assertThat(response.getBody()).containsEntry("code", "unauthorized");
        }
    }

    @Test void realHttpPreflightAcceptsAngularWithoutAuthentication() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin("http://localhost:4200");
        headers.set("Access-Control-Request-Method", "PUT");
        headers.set("Access-Control-Request-Headers", "authorization,content-type");
        var response = http.exchange("/api/profile/me", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:4200");
    }

    @Test void documentationIsNotPublicOutsideDevelopment() {
        for (String path : new String[]{"/swagger-ui.html", "/swagger-ui/index.html", "/v3/api-docs",
                "/v3/api-docs/swagger-config", "/v3/api-docs.yaml"}) {
            assertThat(http.getForEntity(path, String.class).getStatusCode().value()).isEqualTo(401);
        }
    }
}
