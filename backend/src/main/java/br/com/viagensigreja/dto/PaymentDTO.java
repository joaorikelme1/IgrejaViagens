package br.com.viagensigreja.dto;

import lombok.Data;

@Data
public class PaymentDTO {

    private String userCpf;
    private String tripId;

    private int totalInstallments;
    private int paidInstallments;

    private int dueDay;
}