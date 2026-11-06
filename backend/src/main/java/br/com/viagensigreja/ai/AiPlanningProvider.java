package br.com.viagensigreja.ai;

public interface AiPlanningProvider {

    String providerName();

    String configuredModel();

    boolean isConfigured();

    AiProviderResponse generate(TripPlanningSnapshot snapshot, AiPlanningFocus focus);
}
