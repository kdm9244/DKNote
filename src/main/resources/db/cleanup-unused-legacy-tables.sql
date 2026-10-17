-- 수동 실행 전용: 현재 JPA 엔티티에서 사용하지 않는 빈 구형 테이블 정리
-- PostgreSQL 백업 후 실행하세요. 애플리케이션 시작 시 자동 실행되지 않습니다.

BEGIN;

DO $$
DECLARE
    legacy_row_count BIGINT;
BEGIN
    SELECT
        (SELECT count(*) FROM activity_candidates) +
        (SELECT count(*) FROM activity_likes) +
        (SELECT count(*) FROM board_post_likes) +
        (SELECT count(*) FROM booking_links) +
        (SELECT count(*) FROM candidate_votes) +
        (SELECT count(*) FROM cards) +
        (SELECT count(*) FROM categories) +
        (SELECT count(*) FROM exchange_rates) +
        (SELECT count(*) FROM hotel_candidates) +
        (SELECT count(*) FROM income_allocation_items) +
        (SELECT count(*) FROM income_allocations) +
        (SELECT count(*) FROM monthly_reviews) +
        (SELECT count(*) FROM prompt_drafts) +
        (SELECT count(*) FROM restaurant_candidates) +
        (SELECT count(*) FROM tags) +
        (SELECT count(*) FROM transaction_tags)
    INTO legacy_row_count;

    IF legacy_row_count <> 0 THEN
        RAISE EXCEPTION '정리 대상 구형 테이블에 %건의 데이터가 있어 작업을 중단합니다.', legacy_row_count;
    END IF;
END $$;

-- category_id는 현재 문자열 분류명으로 사용하므로 컬럼은 남기고 구형 FK만 제거합니다.
ALTER TABLE IF EXISTS budgets
    DROP CONSTRAINT IF EXISTS fk_budgets_category;
ALTER TABLE IF EXISTS transactions
    DROP CONSTRAINT IF EXISTS fk_transactions_category,
    DROP CONSTRAINT IF EXISTS fk_transactions_card,
    DROP COLUMN IF EXISTS card_id;
ALTER TABLE IF EXISTS fixed_expenses
    DROP CONSTRAINT IF EXISTS fk_fixed_expenses_category,
    DROP CONSTRAINT IF EXISTS fk_fixed_expenses_card,
    DROP COLUMN IF EXISTS category_id,
    DROP COLUMN IF EXISTS card_id;

DROP TABLE IF EXISTS candidate_votes;
DROP TABLE IF EXISTS hotel_candidates;
DROP TABLE IF EXISTS restaurant_candidates;
DROP TABLE IF EXISTS activity_likes;
DROP TABLE IF EXISTS booking_links;
DROP TABLE IF EXISTS activity_candidates;
DROP TABLE IF EXISTS board_post_likes;
DROP TABLE IF EXISTS prompt_drafts;

DROP TABLE IF EXISTS transaction_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS income_allocation_items;
DROP TABLE IF EXISTS income_allocations;
DROP TABLE IF EXISTS monthly_reviews;
DROP TABLE IF EXISTS exchange_rates;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS categories;

COMMIT;
