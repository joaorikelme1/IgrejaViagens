package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;
import java.util.Set;

@Entity
@Table(name = "app_user")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private String cpf;

    private String name;

    @ToString.Exclude
    private String password;
    private String role;
    private String birthdate;
    private boolean firstLogin;

    private boolean married;
    private String spouseName;
    private String spouseCpf;

    private boolean hasKids;

    @Column(columnDefinition = "TEXT")
    @ToString.Exclude
    private String profilePhoto;

    @ElementCollection
    @CollectionTable(name = "user_kids", joinColumns = @JoinColumn(name = "user_cpf"))
    private List<String> kids;

    @ElementCollection
    @CollectionTable(name = "user_child_cpfs", joinColumns = @JoinColumn(name = "user_cpf"))
    @Column(name = "child_cpf")
    private Set<String> childCpfs;

    /** Compatibilidade com criadores internos anteriores aos vinculos por CPF. */
    public User(
            String cpf,
            String name,
            String password,
            String role,
            String birthdate,
            boolean firstLogin,
            boolean married,
            String spouseName,
            boolean hasKids,
            List<String> kids
    ) {
        this(cpf, name, password, role, birthdate, firstLogin, married,
                spouseName, null, hasKids, null, kids, new java.util.LinkedHashSet<>());
    }
}
