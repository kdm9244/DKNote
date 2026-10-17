package com.dm.travel_planner;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 현재 JPA 엔티티를 기준으로 문서용 DDL을 생성합니다.
 * 일반 테스트에서는 실행되지 않으며 scripts/generate-schema.ps1을 통해서만 실행합니다.
 */
@EnabledIfSystemProperty(named = "generate.schema", matches = "true")
@SpringBootTest(properties = {
        "spring.main.web-application-type=none",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.jpa.properties.jakarta.persistence.schema-generation.database.action=none",
        "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.action=create",
        "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.create-target=target/schema-current.sql",
        "spring.jpa.properties.hibernate.hbm2ddl.delimiter=;"
})
class SchemaDocumentationTest {

    @Test
    void generateCurrentJpaSchema() {
        // Spring 컨텍스트가 시작될 때 Hibernate가 target/schema-current.sql을 생성합니다.
    }
}
