# 배포 전 보안·운영 정적 검토

후속 반영 (2026-10-17): 인증 실패 시 첫 계정으로 대체하는 8개 분기를 제거했고, AI 입력·모델·자원 제한과 운영 prod 설정을 추가했습니다. Google 자동 가입과 비밀번호 정책은 사용자 요청으로 유지합니다. PDF·체크리스트의 비공개 R2 저장 및 명시적 로컬 파일 이전 코드를 추가했습니다. 실제 자격증명 등록과 파일 이전은 미실행입니다. 자세한 현재 상태는 PRODUCTION_SETUP.md와 R2_SETUP.md를 확인하세요. 아래 본문은 수정 전 최초 검토 기록이며, 수정 후 테스트·빌드는 실행하지 않았습니다.

검토일: 2026-10-17 (한국 시간)

판정: 공개 배포 전에 아래 수정·설정이 필요합니다. 이번 작업은 코드와 설정의 정적 검토이며 테스트, 빌드, 서버 기동, 공격 재현, 의존성 취약점 스캐너는 실행하지 않았습니다. 애플리케이션 코드는 변경하지 않았습니다.

## 배포 전에 수정할 코드

### 1. 인증 사용자 추출 실패 시 첫 번째 사용자로 처리하는 코드 제거

- 위치: `AccountController.java:30`, `TransactionController.java:34`, `FixedExpenseController.java:34`, `LedgerDashboardController.java:39`, `AccountTransferController.java:42`, `ForeignCurrencyController.java:62`, `FinancialPlanningController.java:117`, `InvestmentController.java:171`.
- 공통적으로 `UserPrincipal`을 얻지 못하면 `userRepository.findAll().stream().findFirst()`로 사용자 ID를 선택합니다.
- 이 분기가 실행되면 요청자의 신원이 아닌 첫 번째 계정의 가계부·계좌를 조회하거나 수정할 수 있습니다. 신원을 확정할 수 없을 때는 401로 종료해야 합니다.
- 현재 SecurityFilterChain은 해당 API에 인증을 요구하고 JWT 필터는 UserPrincipal을 만듭니다. 따라서 이번 검토로 '미인증 요청이 즉시 다른 계정을 읽을 수 있다'고 확인한 것은 아닙니다. 인증 타입이나 필터 구성이 달라지는 순간 계정 경계를 깨는 위험한 기본 동작이 남아 있다는 판단입니다.
- 조치: 8곳 모두 첫 사용자 대체 분기를 제거하고, 공통 인증 사용자 추출 함수 또는 타입이 지정된 `@AuthenticationPrincipal UserPrincipal`을 사용합니다.

### 2. Google 자동 가입에도 가입 제한 적용

- 위치: `AuthController.java:33`, `CustomOAuth2UserService.java:60`, `CustomOAuth2UserService.java:71`, `LoginPolicy.java:11`, `application.yml:45`.
- `SIGNUP_ENABLED=false` 검사는 로컬 `/api/auth/signup`에만 있습니다. Google 로그인은 존재하지 않는 이메일이면 자동으로 계정을 생성합니다.
- 허용 이메일 목록이 빈 값이면 LoginPolicy는 모든 이메일을 허용합니다. 기본 설정 그대로 공개하면 가입을 껐다고 생각해도 새로운 Google 계정으로 가입할 수 있습니다.
- 개인 서비스라면 배포 환경에 `ALLOWED_LOGIN_EMAILS`를 반드시 지정하고, 신규 Google 가입도 명시적인 정책으로 제한해야 합니다. 기존에 등록한 Google 계정의 로그인은 계속 허용하도록 분리합니다.
- 이는 기존 사용자 데이터 접근이 바로 가능하다는 의미는 아닙니다. 의도치 않은 계정 생성과 AI·저장소 자원 사용이 열리는 문제입니다.

### 3. 4자 비밀번호 정책 강화

- 위치: `SignUpRequest.java:20`, `PasswordChangeRequest.java:15`, 프론트 회원가입·비밀번호 변경 안내.
- 가입과 비밀번호 변경에서 4자 비밀번호가 허용됩니다. BCrypt 저장은 적용되어 있으나 짧은 비밀번호 자체를 보완하지 못합니다.
- MFA 없는 로컬 로그인은 긴 비밀번호를 요구하고 유출 비밀번호를 차단하는 방향이 적절합니다. 서버 검증과 프론트 안내·minLength를 함께 변경해야 합니다.
- 현재 계정의 비밀번호가 강한지는 코드로 판단할 수 없습니다. 기존의 짧은 비밀번호도 별도 변경해야 합니다.
- 로그인은 요청 제한이 있지만 비밀번호 변경(`/api/users/myPassword`)에는 현재 필터의 제한이 적용되지 않습니다. 변경 시도에 대한 별도 제한도 필요합니다.
- 기준: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### 4. 노트북 AI 요청의 서버 제한 추가

- 위치: `LaptopAiController.java:45`, `LaptopAiController.java:47`, `LaptopAiController.java:65`.
- 서버는 모델 문자열과 비어 있지 않은 messages 목록만 검사하고, 나머지 요청 본문을 그대로 Ollama에 전달합니다.
- 브라우저의 모델 선택 제한은 직접 API를 호출하는 사용자에게 적용되지 않습니다. 임의 모델, 큰 대화, 큰 `options.num_ctx`·생성 길이 등을 전달해 노트북 자원을 과도하게 사용할 수 있습니다.
- 조치: 서버 모델 허용 목록, 메시지 수·문자 수·본문 크기 제한, 역할 검증, 허용 옵션만 새로 구성하는 방식을 적용합니다. 사용자별 요청 속도 외에 전체 동시 생성 수와 스트림 종료 제한도 필요합니다.
- 기존 필터의 분당 30회 제한은 동시 생성 수나 요청 1건의 메모리·연산량을 제한하지 못합니다.
- 연결 주소는 서버 환경변수에서만 받으므로, 이번 검토에서 사용자가 임의 URL로 프록시 목적지를 바꾸는 경로는 확인하지 못했습니다.

## 배포 환경에서 반드시 결정할 항목

### 5. 업로드 파일의 영구 저장

- 위치: `WorkspaceFiles.java:39`, `ChecklistService.java:183`, `application.yml:51`.
- PDF와 여행 준비물 첨부파일을 서버 로컬 디스크에 저장합니다. 일부 기본 경로는 현재 PC의 Windows 절대 경로입니다.
- Heroku를 사용하면 로컬 파일은 재시작·재배포 시 유실될 수 있습니다. DB에 파일 정보가 남아 있어도 실제 파일을 다운로드하지 못하게 됩니다.
- 조치: 비공개 객체 저장소로 전환하고, 사용자 소유권을 검사한 다운로드 경로나 유효기간이 짧은 서명 URL을 사용합니다. 파일과 DB의 백업·보존 정책도 함께 정합니다.
- 근거: [Heroku 업로드 파일 보존 안내](https://help.heroku.com/K1PPS2WM/why-are-my-file-uploads-missing-deleted-from-the-application).

### 6. 운영 프로필·DB 권한·주소 설정

- 위치: `application.yml:3`, `application.yml:6`, `application.yml:7`, `application.yml:18`, `SecurityConfig.java:129`, `GoogleCalendarService.java:45`.
- 현재 기본 DB는 localhost의 `postgres` 사용자이며 Hibernate는 `ddl-auto: update`입니다. 운영 전용 설정 파일과 배포 파일은 확인되지 않았습니다.
- 운영 DB 연결과 TLS를 공급자 요구에 맞추고, 앱 전용 최소 권한 계정을 사용합니다. 스키마는 버전 관리된 마이그레이션으로 적용한 뒤 `validate` 등을 사용하도록 운영 절차를 정합니다.
- `application-secret.yml`은 Git 제외 대상이지만 Google OAuth 설정 구조와 DB_PASSWORD 참조가 이 파일 안에 있습니다. 새 체크아웃·원격 빌드에는 파일이 없을 수 있으므로 환경변수만 설정하면 기존 로컬 파일 내용까지 생기는 것으로 생각하면 안 됩니다. 비밀값 없이 공유 가능한 설정 구조와 운영 환경변수를 분리해야 합니다.
- 확인한 application-secret.yml과 target/classes 사본의 비밀번호·OAuth 비밀값은 환경변수 참조이고, 해당 참조에 비밀값 기본값은 없었습니다. 파일 이름만으로 비밀키가 하드코딩됐다고 판정하지 않았습니다.
- 새 도메인을 쓰면 CORS와 Google 캘린더 연결 origin 허용 목록, Google 콘솔의 콜백 URL을 함께 정리합니다. 같은 출처 배포는 일반 API의 교차 출처 CORS 설정이 필요하지 않을 수 있지만, 캘린더 연결 서비스 내부 origin 검사는 별개입니다.
- 노트북 연결은 인증된 HTTPS 게이트웨이·터널 또는 사설 연결로 구성합니다. `OLLAMA_AUTH_TOKEN`은 헤더 전달 설정일 뿐이며 게이트웨이에서 실제 검증해야 합니다. 아직 배포나 터널 구성이 없으므로 외부 노출 상태는 확인하지 않았습니다.

## 추가 보완 권장

### JWT 즉시 무효화

- 위치: `UserService.java:107`, `JwtAuthenticationFilter.java:30`, `application.yml:35`.
- 비밀번호를 바꿔도 이미 발급된 JWT는 서명·만료가 유효하면 계속 인증됩니다. 기본 유효기간은 24시간입니다. 로그아웃도 브라우저 저장소 삭제 방식입니다.
- 탈취된 토큰의 사용을 중단하려면 토큰 버전·passwordChangedAt·jti 기반 폐기 정책 등 서버 검사가 필요합니다. 브라우저 토큰 삭제만으로 다른 곳에 복사된 JWT가 취소되지는 않습니다.
- 기준: [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

### Google 갱신 토큰 보관

- 위치: `User.java:43`, `User.java:46`, `GoogleCalendarService.java:74`.
- Google access/refresh token을 일반 문자열 컬럼에 저장하며, 확인한 저장 경로에 애플리케이션 암호화가 없습니다. DB 저장소 암호화 여부는 배포 환경이 없어 확인하지 못했습니다.
- refresh token은 사용자 캘린더 접근에 사용되므로 DB 덤프·백업 접근을 제한하고, DB와 분리한 키로 암호화하는 방안을 권장합니다. 사용자 응답 DTO에는 토큰 자체를 반환하지 않습니다.

### 업로드 형식·총량 제한

- 위치: `ChecklistService.java:176`, `ChecklistService.java:194`, `ChecklistService.java:201`.
- 준비물 첨부파일은 항목별 10개 제한과 전역 multipart 크기 제한이 있지만, 파일 내용과 허용 형식 검증 없이 저장하고 클라이언트 Content-Type을 기록합니다. 사용자별 누적 용량 한도는 확인되지 않았습니다.
- PDF 전용 업로드는 20MB와 `%PDF-` 헤더를 검사합니다. 준비물 첨부파일도 실제 필요한 형식을 정해 내용 검사·파일명 정규화·사용자 총량 제한을 추가하는 것이 좋습니다.
- 첨부 다운로드는 소유권 확인 후 attachment 응답을 사용하므로, 이 사실만으로 업로드 파일의 즉시 스크립트 실행이나 서버 코드 실행이 가능하다고 판정하지 않았습니다.
- 기준: [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### 운영 헤더·요청 제한

- CSP는 명시적으로 설정되어 있지 않습니다. 외부 폰트·PDF 뷰어·인라인 스타일 등 현재 사용처에 맞춰 먼저 정책을 설계해야 합니다. CSP 부재 자체를 XSS 취약점의 재현으로 판단하지 않았습니다.
- 로그인·AI 요청 제한은 애플리케이션 메모리 기반입니다. 재시작·다중 인스턴스에서 제한이 초기화되거나 분산됩니다. 프록시의 클라이언트 IP 신뢰 범위와 외부 요청 제한을 배포 방식에 맞게 정해야 합니다.
- DB/업로드 백업, 로그에 담기는 이메일·금융 기록의 보존 기간, 의존성 취약점 대조와 업데이트 절차도 배포 준비에 포함해야 합니다.

## 확인된 기본 보호

- BCrypt 비밀번호 해시와 JWT 서명·만료 검증이 있습니다.
- 보호 API는 기본적으로 인증이 필요합니다. SPA 화면 경로의 permitAll과 데이터 API 접근 권한은 구분되어 있습니다.
- 점검한 학습·여행·가계부 서비스 경로에는 현재 사용자 ID를 기준으로 한 소유권 확인이 있습니다. 위 첫 사용자 대체 분기는 별도 제거가 필요합니다.
- PDF 다운로드와 준비물 첨부 다운로드는 사용자 권한을 확인하며 경로 이탈 검사와 비공개 캐시 설정이 있습니다.
- 리치 텍스트는 DOMPurify 허용 목록을 거친 뒤 렌더링합니다.
- Google 이메일 검증, 별도 캘린더 연결의 난수 state·10분 만료·일회성 소비·PKCE가 있습니다.
- API 응답 DTO는 Google 토큰 자체를 반환하지 않습니다. OAuth 로그인 토큰은 URL fragment로 전달하고 프론트가 주소에서 제거합니다.
- 텍스트 파일 325개의 정적 패턴 확인에서 Google/OpenAI/GitHub/AWS 키, PEM 개인키, 리터럴 JWT의 고신뢰 패턴은 발견하지 못했습니다. 모든 형식의 비밀값이나 Git 과거 이력까지 없다고 보증하는 결과는 아닙니다.

## 검토 한계

테스트·빌드·서버·DB·외부 API 요청·공격 재현은 실행하지 않았습니다. 배포 계정, 실제 환경변수 값, 운영 DB 권한·TLS·백업, 프록시/터널 설정, Git 이력, 의존성 취약점 DB는 확인하지 않았습니다. 코드와 설정에서 확인한 사실을 기준으로 한 배포 준비 검토이며, 안전성을 보증하는 보안 인증은 아닙니다.
