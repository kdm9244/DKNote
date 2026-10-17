package com.dm.travel_planner.domain.ledger.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

/**
 * 가계부 DB 제약조건 마이그레이션 러너.
 * 애플리케이션 기동 시 PostgreSQL accounts 테이블의 check 제약조건에 'CASH'가 포함되도록 안전하게 갱신합니다.
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class LedgerDatabaseMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        if (!isPostgres()) {
            log.debug("PostgreSQL 환경이 아니므로 accounts_account_purpose_check 마이그레이션을 건너뜁니다.");
            return;
        }

        try {
            // accounts_account_purpose_check 제약조건에 CASH가 포함되어 있는지 확인
            String checkQuery = """
                SELECT conname, pg_get_constraintdef(c.oid) as def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'accounts' AND c.conname = 'accounts_account_purpose_check'
            """;

            var rows = jdbcTemplate.queryForList(checkQuery);
            if (!rows.isEmpty()) {
                String def = (String) rows.get(0).get("def");
                if (def != null && def.contains("'CASH'") && def.contains("'TRANSIT_CARD'")) {
                    log.debug("accounts_account_purpose_check 제약조건에 이미 'CASH' 및 'TRANSIT_CARD'가 포함되어 있습니다.");
                    return;
                }
            }

            // 제약조건 안전 갱신 실행
            jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint c
                        JOIN pg_class t ON c.conrelid = t.oid
                        WHERE t.relname = 'accounts' AND c.conname = 'accounts_account_purpose_check'
                    ) THEN
                        ALTER TABLE accounts DROP CONSTRAINT accounts_account_purpose_check;
                    END IF;

                    ALTER TABLE accounts ADD CONSTRAINT accounts_account_purpose_check
                        CHECK (account_purpose IN (
                            'CASH', 'TRANSIT_CARD', 'GENERAL_CHECKING', 'SALARY_CHECKING', 'LIVING_CHECKING',
                            'EMERGENCY_CHECKING', 'ALLOWANCE_CHECKING', 'INSTALLMENT_SAVINGS',
                            'TIME_DEPOSIT', 'FREE_SAVINGS', 'STOCK_BROKERAGE', 'CMA', 'NISA',
                            'PENSION', 'OTHER_INVESTMENT', 'FOREIGN_SAVINGS', 'FOREIGN_LIVING',
                            'LOAN', 'CREDIT_LINE'
                        ));
                END $$;
            """);

            log.info("가계부 DB 제약조건 마이그레이션 완료: accounts_account_purpose_check에 'CASH', 'TRANSIT_CARD' 추가됨.");
        } catch (Exception e) {
            log.warn("가계부 accounts_account_purpose_check 제약조건 갱신 중 예외 발생 (무시 가능하거나 수동 확인 필요): {}", e.getMessage());
        }
    }

    private boolean isPostgres() {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            String dbName = metaData.getDatabaseProductName();
            return dbName != null && dbName.toLowerCase().contains("postgres");
        } catch (Exception e) {
            log.debug("DB 메타데이터 확인 실패, PostgreSQL 체크 생략: {}", e.getMessage());
            return false;
        }
    }
}
