package com.immovia.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.immovia.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "debug=false", "springdoc.swagger-ui.path=/docs", "springdoc.api-docs.path=/openapi",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration"
})
@ActiveProfiles({"supabase", "dev"})
class SwaggerCustomPathHttpTest {
    @Autowired TestRestTemplate http;
    @MockitoBean ProfileRepository repository;

    @Test void customDocumentationPathsWorkAndBusinessEndpointsRemainProtected() {
        assertThat(http.getForEntity("/docs", String.class).getStatusCode().value()).isBetween(200, 399);
        var docs = http.getForEntity("/openapi", JsonNode.class);
        assertThat(docs.getStatusCode().value()).isEqualTo(200);
        assertThat(docs.getBody().path("openapi").asText()).startsWith("3.");
        var config = http.getForEntity("/openapi/swagger-config", JsonNode.class);
        assertThat(config.getStatusCode().value()).isEqualTo(200);
        assertThat(config.getBody().path("url").asText()).isEqualTo("/openapi");
        assertThat(http.getForEntity("/openapi.yaml", String.class).getStatusCode().value()).isEqualTo(200);
        assertThat(http.getForEntity("/api/profile/me", String.class).getStatusCode().value()).isEqualTo(401);
    }
}
