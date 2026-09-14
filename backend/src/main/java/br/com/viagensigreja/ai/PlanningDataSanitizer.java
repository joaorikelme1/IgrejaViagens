package br.com.viagensigreja.ai;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;

@Component
public class PlanningDataSanitizer {

    private static final Pattern CPF = Pattern.compile(
            "(?<!\\d)\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}(?!\\d)"
    );
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b"
    );
    private static final Pattern PHONE = Pattern.compile(
            "(?<!\\d)(?:\\+?55\\s*)?(?:\\(?\\d{2}\\)?\\s*)?9?\\d{4}[-\\s]?\\d{4}(?!\\d)"
    );

    public String sanitize(String value) {
        return sanitize(value, 1000);
    }

    public String sanitize(String value, int maximumLength) {
        return sanitize(value, maximumLength, Set.of());
    }

    public String sanitize(
            String value,
            int maximumLength,
            Collection<String> personalNames
    ) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String result = CPF.matcher(value).replaceAll("[CPF_REMOVIDO]");
        result = EMAIL.matcher(result).replaceAll("[EMAIL_REMOVIDO]");
        result = PHONE.matcher(result).replaceAll("[TELEFONE_REMOVIDO]");
        Set<String> nameParts = new LinkedHashSet<>();
        if (personalNames != null) {
            personalNames.stream()
                    .filter(name -> name != null && !name.isBlank())
                    .flatMap(name -> Pattern.compile("\\s+").splitAsStream(name.trim()))
                    .filter(part -> part.length() >= 3)
                    .sorted((left, right) -> Integer.compare(right.length(), left.length()))
                    .forEach(nameParts::add);
        }
        for (String namePart : nameParts) {
            Pattern personalName = Pattern.compile(
                    "(?iu)(?<![\\p{L}\\p{N}])" + Pattern.quote(namePart)
                            + "(?![\\p{L}\\p{N}])"
            );
            result = personalName.matcher(result).replaceAll("[NOME_REMOVIDO]");
        }
        result = result.trim().replaceAll("\\s+", " ");
        if (result.length() <= maximumLength) {
            return result;
        }
        return result.substring(0, maximumLength);
    }
}
