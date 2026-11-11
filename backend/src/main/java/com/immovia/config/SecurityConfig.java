package com.immovia.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.immovia.dto.ApiError;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.DefaultCorsProcessor;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class SecurityConfig {
    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwksUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .jwsAlgorithm(SignatureAlgorithm.ES256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer), new SupabaseAccessTokenValidator()));
        return decoder;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper,
            @Value("${immovia.frontend-url}") String frontendUrl, Environment environment,
            @Value("${springdoc.swagger-ui.path:/swagger-ui.html}") String swaggerUiPath,
            @Value("${springdoc.api-docs.path:/v3/api-docs}") String apiDocsPath) throws Exception {
        // Bearer uniquement, sans session serveur ni authentification par cookie.
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .addFilterBefore(corsFilter(mapper, frontendUrl), CsrfFilter.class)
                .authorizeHttpRequests(authorize -> {
                    // Les routes metier restent prioritaires, meme si un chemin Swagger est personnalise.
                    authorize.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                            .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                            .requestMatchers("/api/profile/**").authenticated();
                    if (environment.acceptsProfiles(Profiles.of("dev & !prod"))) {
                        authorize.requestMatchers(HttpMethod.GET, "/swagger-ui.html", "/swagger-ui/**",
                                "/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml",
                                swaggerUiPath, apiDocsPath, apiDocsPath + "/**", apiDocsPath + ".yaml").permitAll();
                    }
                    authorize.anyRequest().denyAll();
                })
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> unauthorized(mapper, response, request.getRequestURI()))
                        .accessDeniedHandler((request, response, exception) -> writeError(mapper, response,
                                ApiError.of(HttpStatus.FORBIDDEN, "forbidden", "Accès non autorisé.", request.getRequestURI()))))
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> { })
                        .authenticationEntryPoint((request, response, exception) -> unauthorized(mapper, response, request.getRequestURI()))
                        .accessDeniedHandler((request, response, exception) -> writeError(mapper, response,
                                ApiError.of(HttpStatus.FORBIDDEN, "forbidden", "Accès non autorisé.", request.getRequestURI()))));
        return http.build();
    }

    private CorsFilter corsFilter(ObjectMapper mapper, String frontendUrl) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(frontendUrl));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        configuration.setExposedHeaders(List.of("WWW-Authenticate"));
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        CorsFilter filter = new CorsFilter(source);
        filter.setCorsProcessor(new DefaultCorsProcessor() {
            @Override
            protected void rejectRequest(ServerHttpResponse response) throws IOException {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                mapper.writeValue(response.getBody(), ApiError.of(HttpStatus.FORBIDDEN,
                        "cors_forbidden", "Origine, méthode ou en-tête CORS non autorisé.", ""));
                response.flush();
            }
        });
        return filter;
    }

    private static void unauthorized(ObjectMapper mapper, HttpServletResponse response, String path) throws IOException {
        response.setHeader("WWW-Authenticate", "Bearer");
        writeError(mapper, response, ApiError.of(HttpStatus.UNAUTHORIZED, "unauthorized",
                "Un jeton d’accès Supabase valide est nécessaire.", path));
    }

    private static void writeError(ObjectMapper mapper, HttpServletResponse response, ApiError error) throws IOException {
        response.setStatus(error.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), error);
    }
}
