package br.com.viagensigreja.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;

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

    private boolean hasKids;

    @ElementCollection
    @CollectionTable(name = "user_kids", joinColumns = @JoinColumn(name = "user_cpf"))
    private List<String> kids;
}
