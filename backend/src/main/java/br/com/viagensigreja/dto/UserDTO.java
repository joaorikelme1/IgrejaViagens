package br.com.viagensigreja.dto;

import lombok.Data;

import java.util.List;

@Data
public class UserDTO {

    private String cpf;
    private String name;
    private String role;

    private boolean married;
    private String spouseName;

    private boolean hasKids;
    private List<String> kids;
}