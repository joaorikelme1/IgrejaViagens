package br.com.viagensigreja.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.ZoneId;

@Component
@ConfigurationProperties(prefix = "app.ai")
public class AiPlanningProperties {

    private boolean enabled = true;
    private Duration generationCooldown = Duration.ofSeconds(5);
    private int maxRequestsPerAdminPerHour = 60;
    private int maxRequestsPerTripPerDay = 200;
    private ZoneId usageTimeZone = ZoneId.of("America/Sao_Paulo");

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Duration getGenerationCooldown() {
        return generationCooldown;
    }

    public void setGenerationCooldown(Duration generationCooldown) {
        this.generationCooldown = generationCooldown == null
                ? Duration.ofSeconds(5)
                : generationCooldown;
    }

    public int getMaxRequestsPerAdminPerHour() {
        return maxRequestsPerAdminPerHour;
    }

    public void setMaxRequestsPerAdminPerHour(int maxRequestsPerAdminPerHour) {
        this.maxRequestsPerAdminPerHour = Math.max(1, maxRequestsPerAdminPerHour);
    }

    public int getMaxRequestsPerTripPerDay() {
        return maxRequestsPerTripPerDay;
    }

    public void setMaxRequestsPerTripPerDay(int maxRequestsPerTripPerDay) {
        this.maxRequestsPerTripPerDay = Math.max(1, maxRequestsPerTripPerDay);
    }

    public ZoneId getUsageTimeZone() {
        return usageTimeZone;
    }

    public void setUsageTimeZone(ZoneId usageTimeZone) {
        this.usageTimeZone = usageTimeZone == null
                ? ZoneId.of("America/Sao_Paulo")
                : usageTimeZone;
    }
}
