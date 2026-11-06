package br.com.viagensigreja.ai;

import java.util.Map;

/**
 * Contexto interno que liga aliases efemeros aos recursos reais.
 * Este objeto nunca deve ser serializado nem exposto fora do backend.
 */
public record TripPlanningContext(
        TripPlanningSnapshot snapshot,
        Map<String, String> travelerCpfByAlias,
        Map<String, String> busIdByAlias,
        Map<String, String> hotelIdByAlias,
        Map<String, String> roomIdByAlias,
        Map<String, String> travelerLabelByAlias,
        Map<String, String> busLabelByAlias,
        Map<String, String> hotelLabelByAlias,
        Map<String, String> roomLabelByAlias
) {
    public TripPlanningContext {
        travelerCpfByAlias = Map.copyOf(travelerCpfByAlias);
        busIdByAlias = Map.copyOf(busIdByAlias);
        hotelIdByAlias = Map.copyOf(hotelIdByAlias);
        roomIdByAlias = Map.copyOf(roomIdByAlias);
        travelerLabelByAlias = Map.copyOf(travelerLabelByAlias);
        busLabelByAlias = Map.copyOf(busLabelByAlias);
        hotelLabelByAlias = Map.copyOf(hotelLabelByAlias);
        roomLabelByAlias = Map.copyOf(roomLabelByAlias);
    }
}
