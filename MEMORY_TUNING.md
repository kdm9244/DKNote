# Heroku Basic 메모리 조정

관측된 로그: 앱 시작 성공 후 총 메모리 약 714~719MB, 할당량 512MB 초과로 R14 반복. 힙/네이티브 메모리 상세 측정은 없으므로 메모리 누수나 특정 코드가 원인이라고 확정하지 않습니다.

## 반영한 변경

- Docker 기본 JVM: 초기 힙 64MB, 최대 힙 192MB, Serial GC, 스레드 스택 512KB, 인식 CPU 2개, 코드 캐시 최대 48MB, 직접 버퍼 최대 32MB. 힙 이외 메모리를 위해 여유를 둡니다. 이 값들을 합친 것이 전체 프로세스 상한은 아닙니다. Metaspace·라이브러리·스택 등도 추가로 사용합니다.
- prod Tomcat: 요청 스레드 최대 16개, 최소 대기 2개, 연결 최대 128개, 연결 대기열 32개. 개인 사용에 맞춘 값으로 동시 요청이 몰리면 대기나 거절이 늘 수 있습니다.
- prod 비동기 작업: 코어 2개, 최대 8개, 대기열 32개, 유휴 30초 후 코어 스레드도 반환합니다. AI 스트리밍은 이 실행기를 사용하며 별도 AI 생성 동시 제한은 유지합니다.
- DB 연결: 최대 3개, 최소 유휴 0개, 유휴 반환 60초. 연결이 모두 사용 중이면 다음 요청은 연결을 기다립니다.
- multipart 파일은 메모리 임계값 0으로 임시 디스크 사용을 명시합니다. 기존 20MB/파일, 100MB/요청 제한은 유지합니다. 최종 보존 저장소는 R2입니다.
- HTTP 세션 유휴 만료를 15분으로 설정합니다. JWT 자체 만료 시간은 그대로입니다.
- KIS 국내·해외 종목 마스터 ZIP: 전체 응답을 byte[]로 받은 뒤 압축 해제하던 방식을 HTTP 응답 스트림에서 직접 압축 해제하도록 변경했습니다. 종목 검색에 사용하는 파싱된 목록 캐시는 유지합니다. 처음 목록을 읽는 과정의 일시적 메모리 복사를 줄이는 변경이며, 시작 직후 R14의 원인으로 확인된 것은 아닙니다.
- AI 시간 제한 작업은 취소 후 스케줄러 대기열에서 즉시 제거합니다.

## 적용

Dockerfile·application-prod.yml·Java 코드 변경은 새 이미지 빌드/업로드/release 후 적용됩니다. 기존 Heroku Config Vars의 JAVA_TOOL_OPTIONS가 있으면 Docker 기본값보다 우선하므로 다음 값으로 맞춥니다.

```cmd
heroku config:set JAVA_TOOL_OPTIONS="-Xms64m -Xmx192m -Xss512k -XX:+UseSerialGC -XX:ActiveProcessorCount=2 -XX:ReservedCodeCacheSize=48m -XX:MaxDirectMemorySize=32m" --app dokumo-note
```

이 명령만으로 JVM 조정은 기존 이미지에도 적용되고 재시작됩니다. 코드 변경까지 적용하려면 프로젝트 폴더에서 실행합니다.

```cmd
docker buildx build --platform linux/amd64 --provenance=false --output type=docker,oci-mediatypes=false -t registry.heroku.com/dokumo-note/web .
docker push registry.heroku.com/dokumo-note/web
heroku container:release web --app dokumo-note
heroku logs --tail --app dokumo-note
```

재배포는 DB 초기화/삭제를 수행하지 않습니다. Flyway의 기존 적용 이력을 유지합니다.

## 검증 상태와 다음 확인

사용자 요청에 따라 수정 후 테스트·빌드·서버 실행·배포·프로파일링을 실행하지 않았습니다. 소스와 설정을 읽어 연결을 확인했습니다. 절감량은 측정하지 않았으며 512MB 내 동작을 보장하지 않습니다.

실제 적용 후 새 기동 시각 이후의 로그와 Heroku Metrics에서 유휴 상태 및 PDF 열기·파일 업로드·종목 검색·AI 스트리밍 사용 후 총 메모리를 확인해야 합니다. R14 또는 OutOfMemoryError가 계속되면 해당 구간의 메모리 측정 결과를 바탕으로 조정합니다. 힙을 계속 낮추는 방식은 실패를 앞당길 수 있으므로 반복하지 않습니다.

참고: [Heroku Java 메모리 안내](https://devcenter.heroku.com/articles/java-memory-issues), [Spring 비동기 실행기 설정](https://docs.spring.io/spring-boot/reference/features/task-execution-and-scheduling.html), [Spring HTTP 응답 스트리밍](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html).
