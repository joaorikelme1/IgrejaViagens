package br.com.viagensigreja.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TripDTO {

    private String id;
    private String name;
    private String destination;
    private String departurePlace;
    private String departureTime;

    private LocalDate date;

    private Integer maxPeople;
    private Double price;

    private String rules;
}