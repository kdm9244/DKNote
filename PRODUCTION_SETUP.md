# 운영 설정과 남은 배포 준비

2026-10-17. 인증 처리·AI 요청 제한·prod 설정을 수정했습니다. 테스트, 빌드, 서버 실행, 실제 DB 및 외부 서비스 접속은 하지 않았습니다.

## 이번에 반영한 변경

- 가계부 관련 컨트롤러 8곳의 '사용자 확인 실패 시 첫 번째 사용자 선택'을 제거했습니다. 공통 `AuthenticatedUser.id`는 유효한 UserPrincipal이 없으면 401로 종료합니다. 정상 로그인 사용자는 기존 ID를 그대로 사용합니다.
- Google 신규 계정 자동 가입과 기존 비밀번호 정책은 사용자 요청에 따라 유지했습니다. Google 테스트 사용자 목록은 Google Cloud 콘솔에서 관리합니다. 앱의 선택적 `ALLOWED_LOGIN_EMAILS` 제한도 그대로 남겨 두었습니다.
- 로컬 비밀 설정 파일이 없어도 DB/OAuth 설정 구조를 읽도록 공통 설정을 환경변수 기반으로 옮겼습니다. application-secret.yml 프로필 자동 포함을 제거했고 해당 파일을 새 리소스 복사 대상에서 제외했습니다. 기존 target 산출물까지 자동 정리하지는 않았으므로 다음 배포 산출물은 깨끗한 빌드에서 생성해야 합니다.
- `prod` 프로필은 운영 DB 연결·사용자명과 공개 HTTPS 주소를 필수로 받고, DB 스키마를 자동 변경하지 않고 validate 합니다. 기본 세션 쿠키는 Secure/HttpOnly/SameSite=Lax이며 오류 응답에 예외 상세를 노출하지 않습니다.
- 운영 CORS는 APP_PUBLIC_URL 하나를 사용합니다. Google 로그인과 별도 캘린더 연결 콜백도 같은 공개 주소를 기준으로 생성합니다. 개발 환경의 기존 주소 목록은 유지합니다.

## AI 제한

| 항목 | 서버 제한 |
| --- | --- |
| 모델 | qwen35-9b-uncensored:latest, qwen3:8b 기본 허용. 서버 OLLAMA_ALLOWED_MODELS로 변경 가능 |
| 요청 본문 | JSON 변환 전 최대 128KiB. Content-Length 없는 요청도 읽기 한도 적용 |
| 메시지 | 1~20개, 개별 16000자, 총 32000자 |
| 역할 | system/user/assistant. system은 첫 메시지에만 허용 |
| 컨텍스트 | 기본 num_ctx=8192. OLLAMA_CONTEXT_TOKENS로 서버에서 조정 |
| 생성 길이 | 기본 num_predict=4096. OLLAMA_MAX_OUTPUT_TOKENS로 서버에서 조정 |
| 배치 | num_batch=128 |
| 온도 | 0.1~0.8 범위, 그 외 모델 옵션은 서버에서 구성 |
| 동시 생성 | 앱 프로세스당 1건. 이미 생성 중이면 429 |
| 전체 생성 시간 | 기본 약 600초(10분). OLLAMA_GENERATION_TIMEOUT_SECONDS로 조정하며 MVC 비동기 제한도 같은 값 사용 |
| 모델 유지 | 5분 |

개인 사용에 맞춰 출력과 시간 기본값을 각각 4096토큰·10분으로 완화했습니다. 출력 토큰에는 모델에 따라 내부 추론 분량도 포함될 수 있으며, 지정 길이를 항상 채운다는 뜻은 아닙니다. 컨텍스트는 한 요청에서 모델이 다루는 문맥 크기이며 앱의 전체 대화 기록 보존 개수와는 다릅니다. 컨텍스트를 늘리면 노트북 메모리 사용량이 커질 수 있으므로 기본값 8192를 유지합니다. 서버 설정 검증 범위는 출력 128~16384토큰(컨텍스트 미만), 컨텍스트 2048~65536토큰, 시간 30~1800초입니다. 배포 프록시의 별도 시간 제한은 이 설정으로 변경되지 않습니다.

기존 분당 요청 제한도 유지합니다. Ollama 상태 API는 허용된 설치 모델 이름만 반환합니다. 원격 Ollama 주소는 HTTPS와 별도 인증 토큰을 요구합니다. 이 토큰을 설정하는 것만으로 인증이 생기지는 않으며 노트북 게이트웨이가 토큰을 검증해야 합니다.

동시 생성 제한은 단일 프로세스 기준입니다. 여러 웹 인스턴스로 확장하면 노트북 게이트웨이나 공통 저장소에서 전역 제한을 적용해야 합니다. 아직 연결된 노트북에서 실제 제한·취소 동작은 실행해 확인하지 않았습니다.

## 운영 환경변수

`.env.prod.example`은 작성 예시입니다. Spring Boot가 이 파일을 자동으로 읽지는 않습니다. Heroku 등 배포 서비스의 Config Vars에 실제 값을 등록합니다. 실제 .env 파일은 Git에서 제외합니다.

| 변수 | 설정 |
| --- | --- |
| SPRING_PROFILES_ACTIVE | prod |
| APP_PUBLIC_URL | 실제 서비스의 https://도메인. 끝의 /와 경로 제외 |
| DB_JDBC_URL | 공급자가 제공한 JDBC PostgreSQL URL. 실제 공급자의 TLS·CA 요구에 맞춰 설정 |
| DB_USERNAME | 앱 전용 DB 사용자. postgres 관리자 계정을 그대로 사용하지 않는 방향 권장 |
| DB_PASSWORD | 운영 DB 비밀번호 |
| JWT_SECRET | 최소 32바이트의 안전한 난수를 Base64로 인코딩한 값 |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | 해당 서비스의 OAuth 앱 값 |
| PORT | 호스팅 서비스 제공 값. 없으면 8080 |
| OLLAMA_BASE_URL / OLLAMA_AUTH_TOKEN | 노트북 연결을 구성한 후 인증된 게이트웨이 주소와 토큰 |

예시 DB URL의 sslmode=require는 암호화를 요청하지만 서버 인증서의 호스트 검증을 보장하는 설정은 아닙니다. 공급자가 지원하는 CA 신뢰 설정과 verify-full 사용 여부를 확인해 적용합니다. DATABASE_URL의 postgres:// 문자열을 DB_JDBC_URL에 그대로 넣으면 안 됩니다. 이 설정은 Java 빌드팩이나 Docker 어느 쪽에서도 직접 등록할 수 있도록 배포 방식과 분리했습니다.

Google 콘솔 승인된 리디렉션 URI:

- https://실제도메인/login/oauth2/code/google
- https://실제도메인/api/calendar/google/callback

Google OAuth 앱의 Testing 상태에서 허용할 계정은 테스트 사용자 목록에 등록합니다. 앱은 현재 캘린더 권한도 요청하므로 단순 프로필 로그인만의 예외 조건과 구분해야 합니다. 콘솔 설정은 이번 작업에서 조회하거나 변경하지 않았습니다.

## DB 초기화 순서

사용자 요청에 따라 Heroku는 기존 데이터를 옮기지 않고 새 DB로 시작합니다. prod에서는 Flyway가 `db/migration/V1__initial_schema.sql`을 빈 DB에 한 번 적용한 뒤 Hibernate가 스키마를 validate 합니다. 재시작할 때 기존 테이블이나 데이터를 삭제하지 않습니다. 기존 데이터가 있는 스키마는 자동 baseline 하지 않으므로 별도 검토가 필요합니다. 로컬 개발의 Flyway는 기본 비활성화입니다. 이후 스키마 변경은 V2 이후의 새 SQL로 추가하며 적용된 V1을 수정하지 않습니다. 상세 배포 절차와 환경변수는 [HEROKU_DEPLOY.md](HEROKU_DEPLOY.md)를 확인하세요.

## Cloudflare 파일 보존

파일 보존에 필요한 제품은 **R2 Object Storage**입니다. Tunnel은 네트워크 연결, Access는 접근 인증 역할이며 파일 저장소가 아닙니다.

권장 구조:

사용자 → Spring Boot 사용자 소유권 확인 → 비공개 R2 버킷

- PDF·준비물 첨부파일은 비공개 버킷에 저장하고, 원본 파일명 대신 충돌하지 않는 객체 키를 사용합니다.
- DB에는 파일명·크기·MIME·객체 키·사용자 소유권을 저장합니다.
- 다운로드 API에서 현재 계정의 소유권을 확인한 뒤 서버 스트리밍 또는 짧은 유효기간의 서명 URL을 발급합니다.
- 버킷 접근 키는 서버에만 저장하고 브라우저 코드에 넣지 않습니다. 버킷 범위를 제한한 읽기·쓰기 자격증명을 사용합니다.
- 기존 로컬 파일은 DB 행만 옮기면 보존되지 않습니다. 실제 파일을 R2로 옮기고 객체 키를 연결해야 합니다.

**R2 어댑터와 PDF·체크리스트의 업로드·다운로드·삭제 연결을 구현했습니다.** prod는 기본적으로 R2를 사용하며 필수 설정이 없으면 시작을 거절합니다. 로컬 개발은 기본 local입니다. 기존 파일은 자동 이전되지 않으며, 배포 전 로컬에서 명시적으로 이전해야 합니다. 설정과 이전 절차는 [R2_SETUP.md](R2_SETUP.md)를 확인하세요. 테스트·빌드·실제 R2 접속은 실행하지 않았습니다.

R2를 실제 연결할 때 서버에 필요한 값은 계정의 S3 API endpoint, 버킷 이름, Access Key ID, Secret Access Key입니다. 민감한 키는 채팅에 붙여 넣기보다 호스팅 환경변수로 등록합니다. 이번 작업에서는 버킷을 생성하거나 계정에 접속하지 않았습니다.

## 공식 문서

- [Google OAuth 앱 상태와 테스트 사용자](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Cloudflare R2 S3 API 시작](https://developers.cloudflare.com/r2/get-started/s3/)
- [Cloudflare R2 Java SDK 예시](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/)
- [Cloudflare R2 서명 URL](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
