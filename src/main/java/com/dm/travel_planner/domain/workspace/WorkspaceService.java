package com.dm.travel_planner.domain.workspace;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.dm.travel_planner.global.storage.StoredFiles;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;
import static com.dm.travel_planner.domain.workspace.WorkspaceEntry.Kind.*;

@Service @RequiredArgsConstructor
public class WorkspaceService {
    private final WorkspaceRepository repository;
    private final WorkspacePreferencesRepository preferences;
    private final ObjectMapper json = new ObjectMapper();
    private final StoredFiles storage;
    public record Edit(String title, String body, String parentId, LocalDate startDate, LocalDate endDate,
                       Boolean completed, Integer position, String format, Map<String,Object> details, Long version) {}
    public record View(String id, WorkspaceEntry.Kind kind, String title, String body, String parentId,
                       LocalDate startDate, LocalDate endDate, boolean completed, int position, String format,
                       Map<String,Object> details, Long version, LocalDateTime createdAt, LocalDateTime updatedAt) {}

    @Transactional(readOnly = true)
    public List<View> list(String uid) { return repository.findByUserIdOrderByPositionAscCreatedAtAsc(uid).stream().map(this::view).toList(); }
    public WorkspaceEntry owned(String uid, String id) {
        return repository.findByIdAndUserId(id, uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "항목을 찾을 수 없습니다."));
    }
    @Transactional
    public View create(String uid, WorkspaceEntry.Kind kind, Edit input) {
        if (kind == PDF) throw bad("PDF는 파일 업로드로 등록하세요.");
        WorkspaceEntry entry = fresh(uid, kind);
        apply(entry, input); validate(entry);
        return view(repository.saveAndFlush(entry));
    }
    WorkspaceEntry fresh(String uid, WorkspaceEntry.Kind kind) {
        WorkspaceEntry entry = new WorkspaceEntry(); entry.setId(UUID.randomUUID().toString());
        entry.setUserId(uid); entry.setKind(kind); entry.setCreatedAt(LocalDateTime.now()); return entry;
    }
    public record WordImport(String requestId,String parentId,int page,String language,List<WordRow> rows) {}
    public record WordRow(String title,String reading,String body) {}
    @Transactional
    public List<View> importWords(String uid,WordImport batch) {
        if(batch.requestId()==null||!batch.requestId().matches("[0-9a-f-]{36}")||batch.rows()==null||batch.rows().isEmpty()||batch.rows().size()>200)throw bad("단어는 한 번에 1~200개를 등록하세요.");
        if(batch.page()<1||batch.page()>100000||batch.language()==null||!Set.of("ja","en","ko","other").contains(batch.language()))throw bad("언어와 페이지를 확인하세요.");
        if(batch.parentId()!=null&&!batch.parentId().isBlank()&&owned(uid,batch.parentId()).getKind()!=PDF)throw bad("PDF 자료를 선택하세요.");
        var existing=repository.findByUserIdOrderByPositionAscCreatedAtAsc(uid).stream().filter(e->e.getKind()==WORD).toList();
        List<View> added=new ArrayList<>();Set<String> keys=new HashSet<>();int index=0;
        for(var row:batch.rows()) {
            String title=row.title()==null?"":row.title().trim(),reading=row.reading()==null?"":row.reading().trim(),body=row.body()==null?"":row.body().trim();
            if(title.isBlank()||title.length()>200||reading.length()>200||body.length()>10000)throw bad("단어·읽는 법은 200자, 뜻은 10000자 이하로 입력하세요.");
            String normalized=java.text.Normalizer.normalize(title,java.text.Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
            String duplicate=normalized+"\u0000"+reading+"\u0000"+body;
            boolean already=existing.stream().anyMatch(e->Objects.equals(e.getParentId(),batch.parentId())&&Objects.equals(read(e.getDetails()).get("language"),batch.language())&&((Number)read(e.getDetails()).getOrDefault("page",1)).intValue()==batch.page()&&java.text.Normalizer.normalize(e.getTitle().trim(),java.text.Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).equals(normalized)&&e.getBody().equals(body)&&Objects.equals(read(e.getDetails()).getOrDefault("reading",""),reading));
            String id=UUID.nameUUIDFromBytes((uid+":"+batch.requestId()+":"+index++).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
            if(already||!keys.add(duplicate)||repository.findByIdAndUserId(id,uid).isPresent())continue;
            var entry=fresh(uid,WORD);entry.setId(id);
            apply(entry,new Edit(title,body,batch.parentId(),null,null,false,0,"plain",Map.of("reading",reading,"language",batch.language(),"page",batch.page()),null));validate(entry);added.add(view(repository.saveAndFlush(entry)));
        }
        return added;
    }
    public record PdfNoteEdit(String body,String format,String previousBody,String previousFormat) {}
    @Transactional
    public View savePdfPage(String uid,String id,int page,PdfNoteEdit note) {
        var entry=owned(uid,id);if(entry.getKind()!=PDF||page<1||page>100000)throw bad("PDF 페이지를 확인하세요.");
        if(note.body()==null||note.body().length()>100000||note.format()==null||!Set.of("plain","markdown","richtext").contains(note.format()))throw bad("필기 형식과 길이를 확인하세요.");
        var details=read(entry.getDetails());var pages=new LinkedHashMap<String,Object>();
        if(details.get("pages") instanceof Map<?,?> old)old.forEach((k,v)->pages.put(String.valueOf(k),v));
        var stored=pages.get(String.valueOf(page)) instanceof Map<?,?> p?p:Map.of();
        if(!Objects.equals(stored.getOrDefault("body",null),note.previousBody())||!Objects.equals(stored.getOrDefault("format",null),note.previousFormat()))throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 화면에서 이 페이지 필기를 변경했습니다. 초안을 보관했으니 새로고침 후 확인하세요.");
        pages.put(String.valueOf(page),Map.of("body",note.format().equals("richtext")?RichTextSanitizer.clean(note.body()):note.body(),"format",note.format()));details.put("pages",pages);entry.setDetails(write(details));entry.setUpdatedAt(LocalDateTime.now());validate(entry);return view(repository.saveAndFlush(entry));
    }
    @Transactional
    public View update(String uid, String id, Edit input) {
        WorkspaceEntry entry = owned(uid,id);
        if (input.version() == null || !input.version().equals(entry.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 화면에서 변경되었습니다. 새로고침 후 다시 저장하세요.");
        if (entry.getKind() == TASK && !Objects.equals(entry.getParentId(),input.parentId())) {
            WorkspaceEntry oldParent = owned(uid,entry.getParentId());
            WorkspaceEntry newParent = owned(uid,input.parentId() == null ? "" : input.parentId());
            if (newParent.getKind() != MILESTONE || !Objects.equals(oldParent.getParentId(),newParent.getParentId()))
                throw bad("할 일은 같은 로드맵 안에서만 이동할 수 있습니다.");
        }
        Map<String,Object> fileDetails = entry.getKind() == PDF ? read(entry.getDetails()) : null;
        apply(entry,input);
        if (fileDetails != null) { // File identifiers are server-owned, never supplied by edits.
            Map<String,Object> next = read(entry.getDetails());
            for (String key : List.of("fileKey","fileName","fileSize")) next.put(key,fileDetails.get(key));
            entry.setDetails(write(next));
        }
        validate(entry);
        return view(repository.saveAndFlush(entry));
    }
    private void apply(WorkspaceEntry e, Edit input) {
        e.setTitle(input.title() == null ? "" : input.title().trim()); e.setBody(input.body() == null ? "" : input.body());
        e.setParentId(input.parentId() == null || input.parentId().isBlank() ? null : input.parentId());
        e.setStartDate(input.startDate()); e.setEndDate(input.endDate());
        e.setCompleted(Boolean.TRUE.equals(input.completed())); e.setPosition(input.position() == null ? 0 : input.position());
        e.setFormat(input.format() == null ? "plain" : input.format());
        if(e.getFormat().equals("richtext"))e.setBody(RichTextSanitizer.clean(e.getBody()));
        e.setDetails(write(input.details() == null ? Map.of() : input.details())); e.setUpdatedAt(LocalDateTime.now());
    }
    private void validate(WorkspaceEntry e) {
        if (e.getTitle().isBlank() || e.getTitle().length() > 200) throw bad("제목은 1~200자로 입력하세요.");
        if (e.getBody().length() > 500000 || e.getDetails().length() > 200000) throw bad("내용이 너무 큽니다.");
        if (!Set.of("plain","markdown","richtext").contains(e.getFormat())) throw bad("지원하지 않는 입력 형식입니다.");
        if (e.getStartDate() != null && e.getEndDate() != null && e.getStartDate().isAfter(e.getEndDate())) throw bad("종료일은 시작일 이후여야 합니다.");
        WorkspaceEntry parent = e.getParentId() == null ? null : owned(e.getUserId(),e.getParentId());
        if (Objects.equals(e.getId(),e.getParentId())) throw bad("자기 자신을 연결할 수 없습니다.");
        switch (e.getKind()) {
            case ROADMAP -> { if(parent != null) throw bad("로드맵은 최상위 목표입니다."); requireDates(e); }
            case MILESTONE -> { requireParent(parent,ROADMAP); requireDates(e); inside(e,parent); }
            case TASK -> { requireParent(parent,MILESTONE); if(e.getStartDate() == null || e.getEndDate() == null) throw bad("할 일의 시작일과 목표일을 입력하세요."); inside(e,parent); }
            case SCHEDULE -> { requireParent(parent,TASK); if(e.getStartDate() == null) throw bad("학습 예정일을 입력하세요."); inside(e,parent); }
            case COMMENT -> { requireParent(parent,RECORD); }
            case WORD -> { if(parent != null) requireParent(parent,PDF); }
            case RECORD, PDF -> { if(parent != null && !Set.of(ROADMAP,MILESTONE,TASK).contains(parent.getKind())) throw bad("학습 목표 또는 할 일에 연결하세요."); if(e.getKind() == RECORD && e.getStartDate() == null) throw bad("공부 날짜를 입력하세요."); }
            case EVENT -> { if(parent != null) throw bad("일정에는 상위 항목을 지정할 수 없습니다."); requireDates(e); validateTimes(e,read(e.getDetails())); }
            case TEMPLATE -> { if(parent != null) throw bad("템플릿에는 상위 항목을 지정할 수 없습니다."); }
            case MEMO -> { if(parent != null) throw bad("메모는 독립 자료로 저장하세요."); }
        }
        if (Set.of(ROADMAP,MILESTONE,TASK).contains(e.getKind())) {
            for(WorkspaceEntry child:repository.findByParentIdAndUserId(e.getId(),e.getUserId()))
                if(Set.of(MILESTONE,TASK,SCHEDULE).contains(child.getKind())) inside(child,e);
        }
        Map<String,Object> details = read(e.getDetails());
        Object checks=details.get("checks");
        if(checks != null && (!(checks instanceof List<?> items) || items.size() > 200)) throw bad("체크 항목은 200개 이하로 입력하세요.");
        if(checks instanceof List<?> items)for(Object item:items)if(!(item instanceof Map<?,?> m)||!(m.get("title") instanceof String title)||title.isBlank()||title.length()>200||m.containsKey("done")&&!(m.get("done") instanceof Boolean))throw bad("체크 항목의 제목과 완료 상태를 확인하세요.");
        if(e.getKind()==WORD&&details.get("page")!=null&&(!(details.get("page") instanceof Number n)||n.intValue()<1||n.intValue()>100000))throw bad("페이지 번호를 확인하세요.");
    }
    private void validateTimes(WorkspaceEntry e,Map<String,Object> details) {
        try {
            for(String key:List.of("startTime","endTime")) if(details.get(key) instanceof String s && !s.isBlank()) LocalTime.parse(s);
            if(Boolean.FALSE.equals(details.get("allDay"))){LocalTime start=LocalTime.parse(details.getOrDefault("startTime","09:00").toString()),end=LocalTime.parse(details.getOrDefault("endTime","10:00").toString());if(e.getStartDate().equals(e.getEndDate())&&!start.isBefore(end))throw bad("종료 시간은 시작 시간 이후여야 합니다.");}
        } catch(Exception ex) { throw bad("올바른 시간을 입력하세요."); }
    }
    private void requireDates(WorkspaceEntry e) { if(e.getStartDate() == null || e.getEndDate() == null) throw bad("시작일과 종료일을 입력하세요."); }
    private void requireParent(WorkspaceEntry e, WorkspaceEntry.Kind kind) { if(e == null || e.getKind() != kind) throw bad("올바른 상위 항목을 선택하세요."); }
    private void inside(WorkspaceEntry e, WorkspaceEntry parent) {
        if(e.getStartDate() != null && parent.getStartDate() != null && e.getStartDate().isBefore(parent.getStartDate()) ||
           e.getEndDate() != null && parent.getEndDate() != null && e.getEndDate().isAfter(parent.getEndDate()) ||
           e.getStartDate() != null && parent.getEndDate() != null && e.getStartDate().isAfter(parent.getEndDate())) throw bad("일정은 상위 목표의 기간 안에 있어야 합니다.");
    }
    @Transactional
    public void delete(String uid, String id) {
        var root=owned(uid,id);List<WorkspaceEntry> doomed=new ArrayList<>(),preserved=new ArrayList<>();
        collectDelete(root,doomed,preserved);
        Map<String,WorkspaceEntry> deleting=new HashMap<>();doomed.forEach(e->deleting.put(e.getId(),e));
        for(var record:preserved){String parent=record.getParentId();while(parent!=null&&deleting.containsKey(parent))parent=deleting.get(parent).getParentId();record.setParentId(parent);record.setUpdatedAt(LocalDateTime.now());repository.save(record);}
        repository.deleteAll(doomed);
        for(var item:doomed)if(item.getKind()==PDF)storage.deleteAfterCommit(StoredFiles.Area.LEARNING,String.valueOf(read(item.getDetails()).getOrDefault("fileKey",item.getId()+".pdf")));
    }
    private void collectDelete(WorkspaceEntry e,List<WorkspaceEntry> doomed,List<WorkspaceEntry> preserved) {
        for(var child:repository.findByParentIdAndUserId(e.getId(),e.getUserId())) {
            if(child.getKind()==RECORD||child.getKind()==PDF)preserved.add(child);
            else collectDelete(child,doomed,preserved);
        }
        doomed.add(e);
    }
    public record Order(String id,Long version) {}
    @Transactional
    public List<View> reorder(String uid,List<Order> orders) {
        if(orders.isEmpty()||orders.size()>1000)throw bad("정렬할 항목을 확인하세요.");
        List<WorkspaceEntry> items=new ArrayList<>();Set<String> ids=new HashSet<>();
        for(var order:orders){var item=owned(uid,order.id());if(!ids.add(item.getId())||!Objects.equals(item.getVersion(),order.version()))throw new ResponseStatusException(HttpStatus.CONFLICT,"목록이 변경되었습니다. 새로고침하세요.");items.add(item);}
        var first=items.getFirst();
        if(!Set.of(MILESTONE,TASK).contains(first.getKind())||items.stream().anyMatch(e->e.getKind()!=first.getKind()||!Objects.equals(e.getParentId(),first.getParentId())))throw bad("같은 목표 안의 목록만 정렬할 수 있습니다.");
        var siblings=repository.findByParentIdAndUserId(first.getParentId(),uid).stream().filter(e->e.getKind()==first.getKind()).toList();
        if(siblings.size()!=items.size())throw new ResponseStatusException(HttpStatus.CONFLICT,"전체 목록을 다시 불러오세요.");
        for(int i=0;i<items.size();i++){items.get(i).setPosition(i);items.get(i).setUpdatedAt(LocalDateTime.now());}
        return repository.saveAllAndFlush(items).stream().map(this::view).toList();
    }
    @Transactional
    public List<View> wordMastery(String uid,List<String> ids,boolean complete) {
        if(ids.size()>10000)throw bad("단어를 나누어 처리하세요.");
        Set<String> keys=new HashSet<>();
        for(String id:ids){var word=owned(uid,id);if(word.getKind()!=WORD)throw bad("단어만 선택하세요.");keys.add(wordKey(word));}
        var words=repository.findByUserIdOrderByPositionAscCreatedAtAsc(uid).stream().filter(e->e.getKind()==WORD&&keys.contains(wordKey(e))).toList();
        words.forEach(e->{e.setCompleted(complete);e.setUpdatedAt(LocalDateTime.now());});
        return repository.saveAllAndFlush(words).stream().map(this::view).toList();
    }
    private String wordKey(WorkspaceEntry e){return read(e.getDetails()).getOrDefault("language","other")+":"+java.text.Normalizer.normalize(e.getTitle(),java.text.Normalizer.Form.NFKC).trim().toLowerCase(Locale.ROOT);}
    @Transactional(readOnly = true)
    public Map<String,Object> settings(String uid) {
        var settings=preferences.findById(uid).map(p -> read(p.getSettings())).orElseGet(HashMap::new);removeClientSecrets(settings);return settings;
    }
    @Transactional
    public Map<String,Object> settings(String uid, Map<String,Object> input) {
        Set<String> allowed=Set.of("aiEnabled","cards","calendarView","weekStart","theme","hiddenCalendarIds","mikaProfile","mikaSettings","mikaMemories","pdfNoteRatio","pdfWordRatio");
        for(String key:List.of("pdfNoteRatio","pdfWordRatio"))if(input.containsKey(key)&&(!(input.get(key) instanceof Number ratio)||!Double.isFinite(ratio.doubleValue())||ratio.doubleValue()<30||ratio.doubleValue()>70))throw bad("PDF 화면 비율은 30~70%로 지정하세요.");
        if(!allowed.containsAll(input.keySet())) throw bad("지원하지 않는 설정입니다.");
        if(input.containsKey("aiEnabled")&&!(input.get("aiEnabled") instanceof Boolean))throw bad("AI 사용 여부를 확인하세요.");
        if(input.containsKey("cards")&&!(input.get("cards") instanceof List<?>))throw bad("홈 카드 목록을 확인하세요.");
        if(input.containsKey("hiddenCalendarIds")&&(!(input.get("hiddenCalendarIds") instanceof List<?> ids)||ids.size()>500||ids.stream().anyMatch(id->!(id instanceof String s)||s.length()>500)))throw bad("캘린더 표시 설정을 확인하세요.");
        for(String key:List.of("mikaProfile","mikaSettings"))if(input.containsKey(key)&&!(input.get(key) instanceof Map<?,?>))throw bad("AI 설정 형식을 확인하세요.");
        if(input.containsKey("mikaMemories")&&(!(input.get("mikaMemories") instanceof List<?> memories)||memories.size()>100||memories.stream().anyMatch(m->!(m instanceof Map<?,?> item)||!(item.get("text") instanceof String text)||text.length()>2000)))throw bad("기억은 100개 이하, 각 2000자 이하로 입력하세요.");
        for(String key:List.of("geminiApiKey","openaiApiKey")) if(input.get("mikaSettings") instanceof Map<?,?> m && m.containsKey(key)) throw bad("API 키는 사용자 설정에 저장할 수 없습니다.");
        if(input.containsKey("theme") && !Set.of("cream","sky").contains(input.get("theme"))) throw bad("지원하지 않는 테마입니다.");
        if(input.containsKey("calendarView") && !Set.of("month","week","day").contains(input.get("calendarView"))) throw bad("지원하지 않는 달력 보기입니다.");
        if(input.containsKey("weekStart") && !List.of(0,1).contains(input.get("weekStart"))) throw bad("주 시작 요일은 일요일 또는 월요일입니다.");
        if(input.get("cards") instanceof List<?> cards && (cards.size() > 4 || new HashSet<>(cards).size() != cards.size() || !Set.of("calendar","learning","ledger","travel").containsAll(cards))) throw bad("홈 카드 설정을 확인하세요.");
        WorkspacePreferences p=preferences.findById(uid).orElseGet(() -> {var v=new WorkspacePreferences();v.setUserId(uid);return v;});
        Map<String,Object> next=read(p.getSettings()); next.putAll(input);removeClientSecrets(next); String serialized=write(next);
        if(serialized.length() > 50000) throw bad("설정 내용이 너무 큽니다.");
        p.setSettings(serialized); preferences.save(p); return next;
    }
    public View view(WorkspaceEntry e) { return new View(e.getId(),e.getKind(),e.getTitle(),e.getBody(),e.getParentId(),e.getStartDate(),e.getEndDate(),e.isCompleted(),e.getPosition(),e.getFormat(),read(e.getDetails()),e.getVersion(),e.getCreatedAt(),e.getUpdatedAt()); }
    public Map<String,Object> read(String value) { try{return json.readValue(value,new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception ex){throw bad("데이터 형식이 올바르지 않습니다.");} }
    public String write(Object value) { try{return json.writeValueAsString(value);}catch(Exception ex){throw bad("데이터 형식이 올바르지 않습니다.");} }
    private void removeClientSecrets(Map<String,Object> settings){if(settings.get("mikaSettings") instanceof Map<?,?> nested){var safe=new LinkedHashMap<String,Object>();nested.forEach((k,v)->{if(!String.valueOf(k).equals("geminiApiKey"))safe.put(String.valueOf(k),v);});settings.put("mikaSettings",safe);}}
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}

