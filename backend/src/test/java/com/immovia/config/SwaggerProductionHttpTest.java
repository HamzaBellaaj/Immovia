package com.immovia.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

/** Meme avec dev demande par erreur, prod doit bloquer Swagger. */
@ActiveProfiles({"supabase", "dev", "prod"})
class SwaggerProductionHttpTest extends HttpSmokeTest {
    @Autowired Environment environment;

    @Test void productionDisablesDocumentationEvenWhenDevIsAlsoActive() {
        assertThat(environment.getProperty("springdoc.api-docs.enabled", Boolean.class)).isFalse();
        assertThat(environment.getProperty("springdoc.swagger-ui.enabled", Boolean.class)).isFalse();
    }
}
