# GitHub Actions 배포

저장소: `kdm9244/DKNote`. `main`의 코드를 Docker 이미지로 빌드하여 기존 Heroku `dokumo-note` 앱의 web 이미지로 배포합니다. 웹 서버 요금제·환경변수·DB·도메인·R2 설정은 변경하지 않습니다. 테스트는 실행하지 않습니다.

## 초기 상태

워크플로는 저장소 변수 `HEROKU_DEPLOY_ENABLED`가 정확히 `true`일 때만 실행됩니다. 최초 소스 업로드 시에는 배포하지 않습니다. PR이나 포크에서는 운영 배포를 수행하지 않습니다. 한번 활성화하면 main push 또는 Actions의 수동 Run workflow로 배포합니다.

## 설정

1. GitHub 저장소 → Settings → Secrets and variables → Actions.
2. Secrets 탭에 `HEROKU_API_KEY`를 추가합니다. Heroku 배포용 토큰 값을 직접 입력하며 채팅·소스·스크린샷·워크플로 파일에 넣지 않습니다. 이 토큰은 Heroku 계정 접근 권한을 가질 수 있으므로 관리자가 보관합니다. 노트북의 CLI 로그인은 GitHub 실행기에 자동 전달되지 않습니다.
3. Variables 탭에 `HEROKU_DEPLOY_ENABLED` = `true`를 추가합니다.
4. Actions → Deploy DKNote to Heroku → Run workflow → main으로 첫 배포를 실행합니다.
5. Actions의 Release 단계 성공 후 Heroku 시작 로그를 확인합니다. 워크플로 성공은 이미지 배포 요청 성공이며 앱 기능·로그인·메모리 검증을 뜻하지 않습니다.

DB·R2·Google·KIS·JWT·Cloudflare Access 키는 기존 Heroku Config Vars에 그대로 둡니다. GitHub에 같은 값들을 복사하지 않습니다. 인증 토큰 없는 외부 요청은 앱이 거부하므로 공개 URL만으로 배포 완료를 판단하지 않습니다.

## 이후 업데이트

로컬에서 수정 → 변경 파일 검토 → commit → main push 순서로 진행합니다. 실제 환경에서 동시에 여러 배포를 적용하지 않도록 워크플로를 직렬화합니다. 배포 중인 작업은 새 push로 강제 취소하지 않습니다.

공개 저장소이므로 계정 비밀번호·메일 목록·개인 기록·업로드 파일은 커밋하지 않습니다. 이전에 커밋한 비밀정보는 gitignore 추가만으로 제거되지 않으며 해당 자격증명 폐기·재발급이 우선입니다.

## 참고

- [Heroku Container Registry & Runtime](https://devcenter.heroku.com/articles/container-registry-and-runtime)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
