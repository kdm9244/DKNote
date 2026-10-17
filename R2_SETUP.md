# 비공개 R2 파일 저장

## 준비된 코드

- 학습 PDF와 체크리스트 첨부파일의 업로드·다운로드·삭제를 공통 저장소에 연결했습니다.
- 로컬 개발 기본값은 `local`, `prod` 기본값은 `r2`입니다. R2 오류 시 로컬로 대체 저장하지 않습니다.
- 서버가 만든 UUID 객체 키를 사용합니다. 원본 파일명과 권한은 기존 DB에 보관합니다. DB 스키마 변경은 없습니다.
- 다운로드는 기존 로그인·소유권 확인 후 Spring 서버가 스트리밍합니다. 버킷은 비공개로 유지합니다. Public Development URL, Custom Domain, 브라우저 R2 CORS 설정은 필요하지 않습니다.
- 업로드는 파일당 20MB입니다. DB 롤백 시 새 객체를 정리하고, 삭제는 DB 커밋 후 실행합니다. 네트워크 오류로 정리에 실패하면 서버 로그의 참조를 기준으로 고아 객체를 나중에 정리해야 합니다. 프로세스 강제 종료에도 고아 객체가 남을 수 있습니다.
- 이번에는 코드만 준비했습니다. 테스트·빌드·서버 실행·실제 R2 접속·기존 파일 이전은 실행하지 않았습니다.

## Heroku에서 등록할 환경변수

Settings → Config Vars에 다음 값을 등록합니다. `.env.prod.example`은 참고용이며 자동으로 로드되지 않습니다.

| 이름 | 값 |
|---|---|
| FILE_STORAGE_PROVIDER | `r2` |
| R2_ENDPOINT | 저장해 둔 Default S3 endpoint, `https://계정ID.r2.cloudflarestorage.com` |
| R2_BUCKET | `dknote-files` |
| R2_ACCESS_KEY_ID | 저장해 둔 Access Key ID |
| R2_SECRET_ACCESS_KEY | 저장해 둔 Secret Access Key |

Endpoint 뒤에 `/dknote-files`를 붙이지 않습니다. `Token value`는 S3 연동에서 사용하지 않습니다. 키는 채팅·Git·프론트엔드·`VITE_*` 변수에 넣지 않습니다. Object Read & Write, dknote-files 버킷 한정 토큰을 사용합니다. R2 자격증명 외에도 [운영 설정](PRODUCTION_SETUP.md)의 DB·Google·JWT 등이 필요합니다.

## 기존 노트북 파일 이전 — 배포 전 별도 작업

기존 DB에는 로컬 경로를 가리키는 행이 있으므로 DB만 Heroku로 옮기면 원본 파일이 따라가지 않습니다. 아래 작업은 **원본 파일이 있는 노트북에서, 기존 DB를 대상으로** 실행합니다. Heroku에서 실행하면 노트북 파일을 읽을 수 없습니다.

1. 기존 DB와 업로드 폴더를 함께 백업합니다. 이전 중에는 앱 사용과 파일 수정·삭제를 멈추고 다른 서버 프로세스를 종료합니다.
2. 수정한 소스로 새 JAR를 준비합니다. 기존 JAR에는 이번 코드가 없습니다. 빌드와 실제 이전은 아직 실행하지 않았습니다.
3. 로컬 실행 환경에 위 R2 변수와 기존 DB·JWT·Google 환경변수를 설정합니다. `LEARNING_UPLOAD_DIR`, `CHECKLIST_UPLOAD_DIR`는 원본 파일이 있는 실제 폴더를 지정합니다. 로컬 프로필을 사용하고 `FILE_STORAGE_PROVIDER=r2`를 명시합니다.
4. 다음 명령으로 **한 번만** 이전 기능을 켜서 실행합니다. 일반 실행에는 이 옵션을 붙이지 않습니다.

```powershell
java -jar target/travel-planner-0.0.1-SNAPSHOT.jar --app.storage.migrate-local-files=true
```

5. 로그에서 `R2 파일 이전 완료: copied=..., failed=0`을 확인합니다. 실패 시 이전되지 않은 행은 기존 경로를 유지하고 앱 시작을 실패 처리합니다. 원인을 수정하고 재실행하면 이미 R2를 가리키는 행은 건너뜁니다. 복사 업로드·검증 다운로드는 R2 사용량으로 계산됩니다.
6. 이 프로세스를 종료한 후 **경로가 갱신된 DB**를 호스팅 DB로 이관합니다. 일반 서버 실행 시 이전 옵션을 제거하되, 이전한 DB를 쓰는 로컬 앱도 `FILE_STORAGE_PROVIDER=r2`와 R2 자격증명을 유지합니다. Heroku에 `R2_MIGRATE_LOCAL_FILES=true`를 등록하지 않습니다.

이전 기능은 파일별 크기와 SHA-256을 비교한 후에만 DB 참조를 변경하며 로컬 원본은 삭제하지 않습니다. PDF 메모·페이지 정보·체크리스트 소유권을 유지합니다. 전체 작업이 하나의 트랜잭션은 아니며 성공한 파일은 유지하여 재실행할 수 있습니다. 실패 로그의 ID로 누락 원본과 접근 권한을 확인합니다. 이전 완료 확인 전 원본 백업을 보존하세요.

## 구현 참고

Cloudflare의 [Java SDK 공식 예시](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/)에 따라 S3 호환 SDK, `auto` 리전, path-style 및 chunked encoding 비활성화를 사용합니다. SDK의 체크섬 호환 설정은 [AWS 문서](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/s3-checksums.html)를 참고했습니다.
