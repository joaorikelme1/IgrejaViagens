package br.com.viagensigreja.ai;

public class AiPlanValidationException extends RuntimeException {

    private final String code;

    public AiPlanValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
