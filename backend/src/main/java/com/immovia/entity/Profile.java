package com.immovia.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "profiles", schema = "public")
public class Profile {
    @Id
    private UUID id;
    @Column(name = "first_name", length = 100)
    private String firstName;
    @Column(name = "last_name", length = 100)
    private String lastName;
    @Column(columnDefinition = "text")
    private String email;
    @Column(length = 30)
    private String phone;
    @Column(name = "is_owner", nullable = false)
    private boolean owner;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Profile() { }

    public UUID getId() { return id; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public boolean isOwner() { return owner; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void completeFromAuth(String firstName, String lastName, String email, String phone, Instant now) {
        boolean changed = false;
        // Un telephone vide apres une modification peut avoir ete efface volontairement.
        boolean untouched = createdAt != null && createdAt.equals(updatedAt);
        if (isBlank(this.firstName) && !isBlank(firstName)) {
            this.firstName = firstName;
            changed = true;
        }
        if (isBlank(this.lastName) && !isBlank(lastName)) {
            this.lastName = lastName;
            changed = true;
        }
        if (isBlank(this.email) && !isBlank(email)) {
            this.email = email;
            changed = true;
        }
        if (untouched && isBlank(this.phone) && !isBlank(phone)) {
            this.phone = phone;
            changed = true;
        }
        if (changed) this.updatedAt = now;
    }

    private static boolean isBlank(String value) { return value == null || value.isBlank(); }

    public void updateDetails(String firstName, String lastName, String phone, Instant now) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
        this.updatedAt = now;
    }

    public void becomeOwner(Instant now) {
        if (!owner) {
            owner = true;
            updatedAt = now;
        }
    }
}
