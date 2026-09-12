package br.com.viagensigreja.service;

import br.com.viagensigreja.model.Bus;
import br.com.viagensigreja.repository.BusRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BusService {

    private final BusRepository repository;

    public BusService(BusRepository repository) {
        this.repository = repository;
    }

    public Bus salvar(Bus bus) {
        if (bus.getId() == null || bus.getId().isBlank()) {
            bus.setId((bus.getTripId() == null ? "bus" : bus.getTripId()) + "_" + System.currentTimeMillis());
        }
        return repository.save(bus);
    }

    public List<Bus> buscarPorTrip(String tripId) {
        return repository.findByTripId(tripId);
    }
}