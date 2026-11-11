package com.immovia.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("dev & !prod")
public class OpenApiConfig {
    @Bean
    public OpenAPI immoviaOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Immovia API").version("v1")
                        .description("API des profils Immovia. Authentification par access token Supabase."))
                .components(new Components().addSecuritySchemes("supabaseBearer", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                        .description("Coller l'access token utilisateur Supabase, sans le prefixe Bearer.")));
    }
}
