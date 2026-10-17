FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /build
COPY pom.xml ./
COPY src/ ./src/
COPY --from=frontend /build/frontend/dist ./frontend/dist
# The user requested no tests. This command builds only when Docker is run explicitly.
RUN mvn -B -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --home-dir /app app \
    && mkdir -p /app/.local && chown -R app:app /app
COPY --from=backend --chown=app:app /build/target/travel-planner-0.0.1-SNAPSHOT.jar /app/app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx192m -Xss512k -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=32m"
ENTRYPOINT ["java", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
