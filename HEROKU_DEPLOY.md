# dokumo-note Docker 배포

운영 주소는 `https://dknote.tech`, 앱 이름은 `dokumo-note`입니다. Heroku 기본 주소는 `https://dokumo-note-719bbc465ce2.herokuapp.com`입니다. 기존 데이터·파일은 이전하지 않습니다. R2 이전 옵션을 켜지 않습니다.

## 준비된 구성과 실행 여부

Dockerfile은 Node 24에서 프론트엔드를 빌드하고 Maven/Java 21에서 정적 파일을 포함한 JAR를 만든 뒤 Java 21 런타임에서 일반 사용자로 실행합니다. 빌드 중에는 테스트를 실행하지 않습니다. 비밀 설정·환경 파일·로컬 데이터·node_modules·기존 target은 빌드 컨텍스트에서 제외합니다. 운영에서는 Heroku의 PORT를 따릅니다.

Heroku가 제공하는 DATABASE_URL을 애플리케이션이 JDBC 주소와 사용자명·비밀번호로 변환합니다. 연결은 TLS를 요구합니다. Docker에서는 Java 빌드팩에 의존하지 않습니다. 다른 호스트로 옮길 때에는 DB_JDBC_URL, DB_USERNAME, DB_PASSWORD 세 값을 함께 지정할 수도 있습니다.

새 운영 DB는 Flyway V1으로 빈 테이블을 만든 후 Hibernate validate를 실행합니다. V1은 기존 schema-current.sql을 바탕으로 준비했습니다. 정상 적용 후에는 Flyway가 적용 이력을 기록하여 재시작 시 다시 만들지 않습니다. 기존 테이블 삭제·초기 데이터 복사는 없습니다. V1 적용 후 스키마 수정은 새 마이그레이션으로 추가합니다.

이번 작업에서 테스트·빌드·Docker 실행·DB 초기화·Heroku 배포는 실행하지 않았습니다. 실제 빌드 및 첫 기동은 아직 확인되지 않았습니다.

## 1. 노트북 준비

- [Docker Desktop Windows 설치](https://docs.docker.com/desktop/setup/install/windows-install/) — 보통 x86_64 Windows용을 선택하고 WSL 2 기반 Linux 컨테이너를 사용합니다. 설치 후 Docker Desktop이 실행 중이어야 합니다.
- [Heroku CLI 설치](https://devcenter.heroku.com/articles/heroku-cli) — 설치 후 새 PowerShell을 엽니다.

## 2. Config Vars — 준비가 끝났을 때 한 번에 등록

Heroku → dokumo-note → Settings → Reveal Config Vars. 아래 표의 값만 직접 입력하면 됩니다. 비밀값을 화면 캡처나 채팅에 공유하지 않습니다.

| KEY | VALUE |
|---|---|
| SPRING_PROFILES_ACTIVE | `prod` |
| JAVA_TOOL_OPTIONS | `-Xms64m -Xmx192m -Xss512k -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=32m` |
| APP_PUBLIC_URL | `https://dknote.tech` (끝 슬래시 제외) |
| JWT_SECRET | 충분히 무작위인 32바이트 이상의 키를 Base64로 표현한 값 |
| GOOGLE_CLIENT_ID | 기존 Google 웹 OAuth 클라이언트 ID |
| GOOGLE_CLIENT_SECRET | 같은 클라이언트의 Secret |
| FILE_STORAGE_PROVIDER | `r2` |
| R2_ENDPOINT | 저장한 Default S3 endpoint, 버킷 경로 제외 |
| R2_BUCKET | `dknote-files` |
| R2_ACCESS_KEY_ID | 저장한 Access Key ID |
| R2_SECRET_ACCESS_KEY | 저장한 Secret Access Key |

DATABASE_URL은 Postgres 추가 시 Heroku가 관리하므로 새로 만들거나 덮어쓰지 않습니다. DB_JDBC_URL/DB_USERNAME/DB_PASSWORD, PORT, SPRING_DATASOURCE_*는 이 구성에서 따로 입력할 필요가 없습니다. R2 Token value도 사용하지 않습니다. 기본 local 회원가입은 비활성화이며 Google 신규 계정 자동 가입은 기존 정책을 유지합니다.

AI 연결은 별도 단계입니다. 현재 기본 Ollama localhost는 Heroku 내부를 뜻하므로 노트북에 연결되지 않습니다. 노트북의 인증된 HTTPS 게이트웨이를 준비한 뒤 OLLAMA_BASE_URL, OLLAMA_AUTH_TOKEN을 추가합니다. 공개된 인증 없는 Ollama 포트를 연결하지 않습니다. 상세 AI 한도는 PRODUCTION_SETUP.md를 참고합니다.

## 3. Google 로그인

기존 OAuth 웹 클라이언트의 승인된 리디렉션 URI에 다음 두 주소가 있는지 확인하고, 없으면 추가합니다. 기존 로컬 주소는 유지해도 됩니다.

```text
https://dknote.tech/login/oauth2/code/google
https://dknote.tech/api/calendar/google/callback
```

Google OAuth Testing 상태에서는 사용할 계정을 테스트 사용자로 등록합니다.

## 4. 빌드와 배포 — 설치·환경변수 등록 후 실행

프로젝트 폴더의 PowerShell에서 실행합니다. 아래 명령은 준비용으로 기록했으며 아직 실행하지 않았습니다. 첫 로그인 두 명령은 브라우저 로그인을 요구할 수 있습니다.

```powershell
heroku login
heroku container:login
heroku stack:set container --app dokumo-note
docker build --platform linux/amd64 -t registry.heroku.com/dokumo-note/web .
docker push registry.heroku.com/dokumo-note/web
heroku container:release web --app dokumo-note
heroku ps:scale web=1 --app dokumo-note
heroku logs --tail --app dokumo-note
```

Heroku는 linux/amd64 이미지를 요구합니다. Dyno 요금제는 대시보드에서 학생 혜택과 선택된 플랜을 확인합니다. 첫 배포 시작 시 새 DB에 V1이 적용되며, 실패하면 로그를 확인하고 원인을 수정합니다. 시작 오류를 피하려고 ddl-auto를 create/create-drop으로 바꾸지 않습니다.

## 5. 도메인 연결과 HTTPS

Heroku에 dknote.tech는 이미 추가했습니다. 앱 시작 준비가 끝난 뒤 기존 DNS 설정을 보관하고, 도메인의 DNS 관리 화면에서 dknote.tech의 레코드를 Heroku가 발급한 **전체 DNS Target**으로 연결합니다. 화면에서 잘린 값을 추측하지 말고 복사한 `*.herokudns.com`을 사용합니다. 기존 동일 이름 A/AAAA/CNAME 또는 Tunnel 라우팅과 충돌하지 않도록 확인합니다. 메일용 MX/TXT 등 다른 레코드는 유지합니다.

Cloudflare에서 DNS를 관리한다면 루트 이름 `@`의 CNAME에 DNS Target을 넣을 수 있습니다. 실제 DNS 화면과 Heroku 인증서 상태를 확인하면서 연결합니다. Heroku 인증서 발급과 HTTPS 구성이 완료된 뒤 Cloudflare 프록시를 켤 경우 SSL/TLS는 Full (strict)를 사용합니다. Flexible은 사용하지 않습니다. DNS는 아직 변경하지 않았습니다.

기본 Heroku URL로 서버 기동 상태를 확인할 수 있지만 로그인·캘린더 콜백과 운영 CORS는 dknote.tech 기준입니다. 도메인과 HTTPS 연결 후 최종 로그인 동작을 확인해야 합니다.

## 공식 근거

- [Heroku Docker 배포](https://devcenter.heroku.com/articles/container-registry-and-runtime)
- [Heroku Postgres 연결](https://devcenter.heroku.com/articles/connecting-heroku-postgres)
- [Spring Boot DB 초기화](https://docs.spring.io/spring-boot/how-to/data-initialization.html)
- [Cloudflare와 Heroku HTTPS](https://developers.cloudflare.com/support/third-party-software/others/configure-cloudflare-and-heroku-over-https/)
