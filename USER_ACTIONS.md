# 사용자가 설정할 항목

현재 로컬 서버에 적용할 수 있는 코드 수정과 테스트는 완료합니다. 계정의 키 발급, Cloudflare 정책과 외부 클라우드 계정 설정은 아래 순서로 진행하세요. 키 값은 채팅이나 Git에 올리지 마세요.

## 1. Gemini 키 교체 — 우선 진행

기존 키가 프런트 JavaScript와 `/api/ai/config` 응답에 노출되어 있었습니다. 노출 경로를 수정한 서버를 반영한 뒤 Google AI Studio에서 기존 Gemini 키를 폐기하고 새 키를 발급하세요. 노트북 사용자 환경변수 `GEMINI_API_KEY`를 새 값으로 바꾸고 `scripts/start-workspace.ps1 -Restart`로 서버를 재시작합니다. AI를 사용하지 않으면 기존 키를 폐기하고 이 변수를 제거해도 됩니다. KIS·Google Client Secret·DB 비밀번호·JWT Secret은 이번 공개 파일 검사에서 발견되지 않았습니다.

## 2. 허용할 로그인 계정 지정

`ALLOWED_LOGIN_EMAILS`에 본인과 승인한 사람의 이메일을 쉼표로 나눠 등록하세요. 예: `owner@example.com,friend@example.com`. 이 값은 Google 로그인과 이메일 로그인을 모두 제한합니다. 값이 비어 있으면 앱 자체 이메일 제한은 적용되지 않으므로 Cloudflare·Google의 기존 설정에 의존합니다. `SIGNUP_ENABLED`는 기본값 `false`로 신규 이메일 회원가입을 차단합니다.

## 3. Cloudflare Access 원본 서버 보호

Cloudflare Zero Trust의 현재 앱에서 팀 도메인과 Application Audience(AUD) 값을 확인하세요.

| 환경변수 | 값 |
|---|---|
| `CLOUDFLARE_ACCESS_REQUIRED` | `true` |
| `CLOUDFLARE_ACCESS_ISSUER` | `https://팀이름.cloudflareaccess.com` — 끝에 `/` 없이 |
| `CLOUDFLARE_ACCESS_AUDIENCE` | 해당 Access 앱의 AUD 값 |

세 항목을 함께 설정한 뒤 재시작하면 서명·issuer·audience·유효기간이 검증된 `Cf-Access-Jwt-Assertion`이 없는 요청은 차단됩니다. 활성화 후에는 localhost로 직접 보는 화면도 차단되며 Cloudflare가 보호하는 도메인을 사용해야 합니다. 상태 검사 `/health`와 OPTIONS는 예외이며 사용자 데이터는 반환하지 않습니다. 클라우드 기본 URL에서도 API 우회가 차단되는지 실제 배포 후 확인해야 합니다. 현재 코드 테스트는 통과했지만 사용자의 실제 Cloudflare 정책·AUD는 아직 검증하지 않았습니다.

## 4. 클라우드로 이전할 때

Heroku Config Vars 등 서버의 비밀 환경변수 저장소에 `JWT_SECRET`, `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`(사용 시), `KIS_APP_KEY`, `KIS_APP_SECRET`와 위 로그인·Cloudflare 설정을 등록하세요. `VITE_` 접두사 변수나 프런트 빌드에 비밀 키를 넣지 않습니다. 클라우드 DB에 맞춰 DB URL·사용자를 변경하고, 외부 파일 저장소에 PDF·사진을 이전해야 합니다. Google OAuth 승인된 리디렉션 URI와 Cloudflare 보호 도메인도 최종 배포 주소에 맞춰 변경하세요. 인증서와 HTTPS를 사용합니다.

## 5. 백업과 로그인

`scripts/backup-local.ps1`은 로컬 PostgreSQL과 PDF·피드·준비물 첨부파일을 `.local/backups/날짜-시간`에 보관합니다. 백업 파일은 개인정보를 포함하므로 접근을 제한하고 노트북 밖의 비공개 저장소에도 별도로 보관하세요. 자동 실행 예약은 아직 설정하지 않았습니다. 백업 아카이브 읽기는 확인하지만 다른 DB에 복원하는 검증은 별도 작업입니다.

인증 토큰은 URL 쿼리 대신 일시적인 fragment로 전달하고, 브라우저 탭 세션에 보관하도록 변경했습니다. 업데이트 후 다시 로그인하세요. 세션 저장소도 JavaScript에서 읽을 수 있으므로 악성 스크립트 방어가 계속 필요합니다. 서식 HTML은 서버와 브라우저에서 정제합니다.

DB 백업에는 구글 연결 토큰 등 민감한 데이터가 포함될 수 있습니다. 백업을 공개 저장소에 업로드하지 말고 별도로 암호화하거나 비공개 보관하세요.

팀 게시글·피드 업로드 기능은 제거했습니다. 여행 자료는 예약·준비물의 인증된 첨부파일로 보관합니다. 기존 브라우저에만 있던 여행 기록은 여행 정보에서 보관 자료로 내려받을 수 있습니다.

## 이번 기능 개선

- PDF와 학습노트에 문서 편집기, 글자색·형광펜·목록·표·코드블록, 안전한 붙여넣기 추가. 기존 Markdown 원문 방식도 유지합니다.
- PDF 분할 너비 조절·필기 넓게 보기·페이지별 자동 저장·브라우저 초안 복구·동시 수정 충돌 보호.
- 단어 표 입력·일괄 붙여넣기·미리보기·중복 안내·뜻 없이 등록·표에서 수정. 동일한 자료/페이지의 완전 중복과 같은 등록 요청 재시도는 중복 저장하지 않습니다.
- 장기 일정과 학습 목표는 주 단위로 이어지는 막대이며, 날짜별 할 일과 구분합니다. 일정이 많으면 선택 날짜 상세에서 모두 확인합니다.

PDF 글자 선택으로 바로 단어를 추가하는 기능은 현재 브라우저 PDF 뷰어를 교체해야 해서 이번 범위에 포함하지 않습니다.
