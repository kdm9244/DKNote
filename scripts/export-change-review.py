"""Read-only comparison of a private source backup with the current project."""
from pathlib import Path
import difflib, zipfile

root = Path(__file__).resolve().parent.parent
archive = root / '.local/backups/20261011-181938/source-before-cleanup.zip'
prefixes = ('frontend/src/', 'src/main/java/', 'src/main/resources/')
suffixes = {'.java', '.js', '.jsx', '.css', '.html', '.svg', '.sql'}
with zipfile.ZipFile(archive) as snapshot:
    old = {name: snapshot.read(name).decode('utf-8-sig').replace('\r\n', '\n') for name in snapshot.namelist()
           if name.startswith(prefixes) and Path(name).suffix in suffixes}
current = {file.relative_to(root).as_posix(): file.read_text(encoding='utf-8-sig')
           for folder in prefixes for file in (root / folder).rglob('*')
           if file.is_file() and file.suffix in suffixes}
changes, patch = [], []
for name in sorted(old.keys() | current.keys()):
    before, after = old.get(name), current.get(name)
    if before == after:
        continue
    kind = '추가' if before is None else '삭제' if after is None else '수정'
    changes.append((kind, name))
    patch.extend(difflib.unified_diff((before or '').splitlines(True), (after or '').splitlines(True),
                                    fromfile='a/' + name if before is not None else '/dev/null',
                                    tofile='b/' + name if after is not None else '/dev/null'))
(root / 'CHANGE_REVIEW.patch').write_text(''.join(patch), encoding='utf-8')
lines = ['# 실제 파일 변경 내역', '',
         'Git 저장소가 인식되지 않아 추가 코드 정리 전 백업과 현재 파일을 직접 비교했습니다.',
         '비교 범위는 프런트 소스, Java 앱 소스, 정적 리소스 및 DB 구조 문서입니다.',
         '환경변수·DB 실제 데이터·비밀 설정은 이 비교 파일에 포함하지 않습니다.',
         '검토용 비교이며 현재 파일을 되돌리거나 덮어쓰지 않습니다.', '',
         '| 상태 | 파일 |', '|---|---|']
lines.extend(f'| {kind} | {name} |' for kind, name in changes)
lines.extend(['', '상세 줄별 차이는 같은 폴더의 `CHANGE_REVIEW.patch`에 있습니다.'])
(root / 'CHANGE_REVIEW.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Wrote a review list and patch for {len(changes)} changed text files; no production files were modified.')
