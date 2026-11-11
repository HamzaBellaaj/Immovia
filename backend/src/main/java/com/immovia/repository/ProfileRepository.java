package com.immovia.repository;

import com.immovia.entity.Profile;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {
    @Modifying
    @Query(value = """
            INSERT INTO public.profiles
                (id, first_name, last_name, email, phone, is_owner, created_at, updated_at)
            VALUES (:id, :firstName, :lastName, :email, :phone, FALSE, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("firstName") String firstName,
                       @Param("lastName") String lastName, @Param("email") String email,
                       @Param("phone") String phone);

    // Serialise les modifications du meme profil, y compris l'activation proprietaire.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Profile p where p.id = :id")
    Optional<Profile> findForUpdate(@Param("id") UUID id);
}
