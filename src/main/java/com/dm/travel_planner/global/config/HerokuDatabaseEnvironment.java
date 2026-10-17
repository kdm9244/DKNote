package com.dm.travel_planner.global.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Docker does not run Heroku's Java buildpack, so translate DATABASE_URL ourselves. */
public class HerokuDatabaseEnvironment implements EnvironmentPostProcessor, Ordered {
    @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }

    @Override public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String raw=environment.getProperty("DATABASE_URL");
        if(raw==null || raw.isBlank() || environment.containsProperty("DB_JDBC_URL")) return;
        try {
            URI uri=URI.create(raw);
            if(!("postgres".equals(uri.getScheme()) || "postgresql".equals(uri.getScheme()))
                    || uri.getHost()==null || uri.getRawUserInfo()==null
                    || uri.getPath()==null || uri.getPath().length()<2 || uri.getFragment()!=null)
                throw new IllegalArgumentException();
            String[] credentials=uri.getRawUserInfo().split(":",2);
            if(credentials.length!=2 || credentials[0].isEmpty() || credentials[1].isEmpty())
                throw new IllegalArgumentException();
            String host=uri.getHost();
            if(host.contains(":") && !host.startsWith("[")) host="["+host+"]";
            String jdbc="jdbc:postgresql://"+host+":"+(uri.getPort()==-1?5432:uri.getPort())+uri.getRawPath()+"?sslmode=require";
            environment.getPropertySources().addLast(new MapPropertySource("herokuDatabase",Map.of(
                    "DB_JDBC_URL",jdbc,"DB_USERNAME",decode(credentials[0]),"DB_PASSWORD",decode(credentials[1]))));
        } catch(RuntimeException ex) {
            // Never include the URL or parser exception: they can contain the DB password.
            throw new IllegalStateException("DATABASE_URL 형식이 올바르지 않습니다. Heroku Postgres 연결 설정을 확인하세요.");
        }
    }
    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+","%2B"),StandardCharsets.UTF_8);
    }
}
