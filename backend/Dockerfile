# ---------- ETAPA 1: build ----------
FROM gradle:jdk17 AS build
WORKDIR /app

COPY build.gradle settings.gradle* ./
COPY src ./src

RUN gradle clean bootJar -x test --no-daemon

# ---------- ETAPA 2: run ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Pega o JAR gerado pelo plugin do Spring Boot.
# Se o build gerar dois arquivos (um "-plain.jar" e outro sem
# esse sufixo), use o SEM "-plain" — é o executável de verdade.
COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
