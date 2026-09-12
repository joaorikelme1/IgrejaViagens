package br.com.viagensigreja.dto;

import lombok.Data;
import lombok.ToString;

@Data
public class LoginDTO {
    private String cpf;

    @ToString.Exclude
    private String password;
}
