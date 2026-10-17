# DKNote

일상과 배움, 여행을 기록하는 개인 웹 애플리케이션입니다.

## 구성

- React / Vite 프론트엔드, Spring Boot / Java 21 백엔드
- PostgreSQL과 Flyway 스키마 관리
- Google 로그인·캘린더 연동, Cloudflare Access 접근 제어
- Cloudflare R2 비공개 PDF·첨부파일 저장
- 여행 계획, 학습 기록, 가계부·투자 관리
- 노트북 Ollama 연결을 통한 선택적 AI 기능

## 실행과 배포

Dockerfile이 프론트엔드와 백엔드를 빌드하여 하나의 이미지로 패키징합니다. 서버 자격증명은 런타임 환경변수로만 전달합니다. `.env.prod.example`은 변수 이름을 설명하는 예시이며 자동으로 로드되지 않습니다.

- [Heroku Docker 배포](HEROKU_DEPLOY.md)
- [GitHub Actions 설정](GITHUB_ACTIONS.md)
- [운영 설정](PRODUCTION_SETUP.md)
- [R2 설정](R2_SETUP.md)
- [노트북 AI 구성](LAPTOP_AI.md)
- [메모리 조정](MEMORY_TUNING.md)

기본 배포는 `prod` 프로필을 사용합니다. 새 PostgreSQL 스키마는 Flyway로 생성하며 기존 데이터가 있는 DB에 임의로 초기화 SQL을 적용하지 않습니다. 운영 앱 접근에는 별도 인증이 필요합니다.

## 비밀정보

DB 비밀번호, JWT 키, OAuth Secret, KIS/R2 키, 배포 토큰은 저장소에 넣지 않습니다. 로컬 `.env`, `application-secret.yml`, `.local` 및 업로드 폴더는 Git에서 제외합니다. GitHub Actions에는 배포용 토큰만 등록하고 앱의 운영 키는 호스팅 서비스에 유지합니다.

사용자 요청에 따라 Docker 빌드에서 테스트 실행은 생략합니다. 빌드 성공이 실제 기능 검증을 대신하지는 않습니다.
