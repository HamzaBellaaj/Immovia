package com.immovia.controller;

import com.immovia.dto.ProfileResponse;
import com.immovia.dto.ProfileUpdateRequest;
import com.immovia.service.ProfileService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
@SecurityRequirement(name = "supabaseBearer")
public class ProfileController {
    private final ProfileService profiles;
    public ProfileController(ProfileService profiles) { this.profiles = profiles; }

    @PostMapping("/sync")
    public ProfileResponse sync(@AuthenticationPrincipal Jwt jwt) { return profiles.sync(jwt); }

    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) { return profiles.me(jwt); }

    @PutMapping("/me")
    public ProfileResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileUpdateRequest request) {
        return profiles.update(jwt, request);
    }

    @PostMapping("/become-owner")
    public ProfileResponse becomeOwner(@AuthenticationPrincipal Jwt jwt) { return profiles.becomeOwner(jwt); }
}
