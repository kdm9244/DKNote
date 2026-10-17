package com.dm.travel_planner.domain.workspace;

import com.dm.travel_planner.domain.user.entity.User;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.util.UriComponentsBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.security.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service @RequiredArgsConstructor
public class GoogleCalendarService {
    public static final String CALENDAR_EVENTS_SCOPE="https://www.googleapis.com/auth/calendar.events";
    public static final String CALENDAR_LIST_SCOPE="https://www.googleapis.com/auth/calendar.calendarlist.readonly";
    public static boolean hasCalendarScopes(String scopes) {
        if(scopes==null||scopes.isBlank())return false;
        var granted=new HashSet<>(Arrays.asList(scopes.trim().split("\\s+")));
        return granted.contains(CALENDAR_EVENTS_SCOPE)&&granted.contains(CALENDAR_LIST_SCOPE);
    }
    private final com.dm.travel_planner.global.config.ApplicationOrigins origins;
    private final UserRepository users;
    private final ClientRegistrationRepository registrations;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, Pending> states = new ConcurrentHashMap<>();
    private record Pending(String uid,String callback,String origin,String verifier,Instant expiry) {}
    private static final String API="https://www.googleapis.com/calendar/v3";
    private ClientRegistration client() {
        var c=registrations.findByRegistrationId("google");
        if(c == null || c.getClientId().contains("${") || c.getClientSecret().contains("${")) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Google 로그인 환경변수를 먼저 설정하세요.");
        return c;
    }
    private String random() {byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    public Map<String,Object> connect(String uid,String callback,String origin) throws Exception {
        if(!origins.allows(origin)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"지원하지 않는 접속 주소입니다.");
        var c=client();String state=random(),verifier=random();
        states.entrySet().removeIf(e -> e.getValue().expiry().isBefore(Instant.now()));
        if(states.size()>10000) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
        states.put(state,new Pending(uid,callback,origin,verifier,Instant.now().plusSeconds(600)));
        String challenge=Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        String url=UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
            .queryParam("client_id",c.getClientId()).queryParam("redirect_uri",callback).queryParam("response_type","code")
            .queryParam("scope","https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly")
            .queryParam("access_type","offline").queryParam("prompt","consent").queryParam("state",state)
            .queryParam("code_challenge",challenge).queryParam("code_challenge_method","S256").build().encode().toUriString();
        return Map.of("url",url,"callback",callback);
    }
    public String callback(String state,String code,String error) throws Exception {
        Pending p=states.remove(state == null ? "" : state);
        if(p == null || p.expiry().isBefore(Instant.now())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"연결 요청이 만료되었습니다. 다시 연결하세요.");
        if(error != null || code == null) return p.origin()+"/settings?google=cancelled";
        var c=client();
        try {
            var token=form("https://oauth2.googleapis.com/token",Map.of("code",code,"client_id",c.getClientId(),"client_secret",c.getClientSecret(),"redirect_uri",p.callback(),"grant_type","authorization_code","code_verifier",p.verifier()));
            var user=user(p.uid());
            if(!(token.get("scope") instanceof String scope) || !hasCalendarScopes(scope)) return p.origin()+"/settings?google=permission";
            saveToken(user,token); return p.origin()+"/settings?google=connected";
        } catch(ResponseStatusException e) {return p.origin()+"/settings?google=failed";}
    }
    private User user(String uid){return users.findById(uid).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));}
    private void saveToken(User u,Map<String,Object> token) {
        Object access=token.get("access_token");if(!(access instanceof String s) || s.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Google 인증 응답이 올바르지 않습니다.");
        u.updateGoogleTokens((String)access,token.get("refresh_token") instanceof String refresh?refresh:u.getGoogleRefreshToken(),LocalDateTime.now().plusSeconds(((Number)token.getOrDefault("expires_in",3600)).longValue()),token.get("scope") instanceof String granted?granted:u.getGoogleGrantedScopes()); users.save(u);
    }
    private String access(String uid) throws Exception {
        User u=user(uid);
        if(u.getGoogleAccessToken()==null) throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,"Google 캘린더를 연결하세요.");
        if(!hasCalendarScopes(u.getGoogleGrantedScopes()))throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,"Google로 다시 로그인하고 캘린더 권한에 동의해주세요.");
        if(u.getGoogleTokenExpiresAt()==null || u.getGoogleTokenExpiresAt().isBefore(LocalDateTime.now().plusSeconds(60))) {
            if(u.getGoogleRefreshToken()==null) throw new ResponseStatusException(HttpStatus.PRECONDITION_REQUIRED,"Google 캘린더를 다시 연결하세요.");
            var c=client();saveToken(u,form("https://oauth2.googleapis.com/token",Map.of("client_id",c.getClientId(),"client_secret",c.getClientSecret(),"refresh_token",u.getGoogleRefreshToken(),"grant_type","refresh_token")));
        }
        return u.getGoogleAccessToken();
    }
    public Map<String,Object> status(String uid) {
        User u=user(uid);return Map.of("tokenAvailable",u.getGoogleAccessToken()!=null,"calendarReady",u.getGoogleAccessToken()!=null&&hasCalendarScopes(u.getGoogleGrantedScopes()),"callbackPath","/api/calendar/google/callback");
    }
    public void disconnect(String uid){User u=user(uid);u.updateGoogleTokens(null,null,null);users.save(u);}
    private Map<String,Object> form(String uri,Map<String,String> fields) throws Exception {
        String body=fields.entrySet().stream().map(e -> enc(e.getKey())+"="+enc(e.getValue())).reduce((a,b)->a+"&"+b).orElse("");
        return send(HttpRequest.newBuilder(URI.create(uri)).timeout(Duration.ofSeconds(15)).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build());
    }
    @SuppressWarnings("unchecked")
    private Map<String,Object> send(HttpRequest request) throws Exception {
        HttpResponse<String> r;
        try {r=http.send(request,HttpResponse.BodyHandlers.ofString());}
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Google 연결이 중단되었습니다.");}
        catch(java.io.IOException e){throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Google 서버에 연결할 수 없습니다.");}
        if(r.statusCode()>=400) {
            HttpStatus status=switch(r.statusCode()){case 401 -> HttpStatus.PRECONDITION_REQUIRED;case 403 -> HttpStatus.FORBIDDEN;case 404,410 -> HttpStatus.NOT_FOUND;case 409,412 -> HttpStatus.CONFLICT;default -> HttpStatus.BAD_GATEWAY;};
            String msg=switch(r.statusCode()){case 401 -> "Google 캘린더를 다시 연결하세요.";case 403 -> "캘린더 권한 또는 Google Calendar API 활성화 상태를 확인하세요.";case 404,410 -> "일정을 찾을 수 없습니다.";case 409,412 -> "일정이 변경되었습니다. 새로고침하세요.";default -> "Google 요청에 실패했습니다. 새로고침 후 확인하세요.";};
            throw new ResponseStatusException(status,msg);
        }
        return r.body().isBlank()?Map.of():json.readValue(r.body(),Map.class);
    }
    private Map<String,Object> request(String uid,String method,String path,Object data,String etag) throws Exception {
        var b=HttpRequest.newBuilder(URI.create(API+path)).timeout(Duration.ofSeconds(15)).header("Authorization","Bearer "+access(uid));
        if(etag!=null&&!etag.isBlank()) b.header("If-Match",etag);
        b.method(method,data==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(data))).header("Content-Type","application/json");
        return send(b.build());
    }
    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> pages(String uid,String path) throws Exception {
        List<Map<String,Object>> result=new ArrayList<>();String page=null;int count=0;
        do {var r=request(uid,"GET",path+(page==null?"":(path.contains("?")?"&":"?")+"pageToken="+enc(page)),null,null);
            result.addAll((List<Map<String,Object>>)r.getOrDefault("items",List.of()));page=(String)r.get("nextPageToken");
            if(++count>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"조회 범위를 줄여주세요.");
        } while(page!=null);return result;
    }
    public List<Map<String,Object>> calendars(String uid) throws Exception{return pages(uid,"/users/me/calendarList?maxResults=250");}
    public List<Map<String,Object>> events(String uid,String calendar,LocalDate start,LocalDate end) throws Exception {
        return pages(uid,eventQueryPath(calendar,start,end));
    }
    static String eventQueryPath(String calendar,LocalDate start,LocalDate end) {
        if(start==null||end==null||start.isAfter(end)||start.plusDays(100).isBefore(end)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"100일 이하의 조회 기간을 지정하세요.");
        // OffsetDateTime.toString() omits zero seconds, which Google rejects as invalid RFC3339.
        var zone=ZoneId.of("Asia/Seoul");
        String min=DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(start.atStartOfDay(zone));
        String max=DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(end.plusDays(1).atStartOfDay(zone));
        return "/calendars/"+enc(calendar)+"/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin="+enc(min)+"&timeMax="+enc(max);
    }
    public Map<String,Object> saveEvent(String uid,String calendar,String event,Map<String,Object> input) throws Exception {
        Map<String,Object> data=new HashMap<>();for(String key:List.of("summary","description","location","start","end")) if(input.containsKey(key))data.put(key,input.get(key));
        if(!(data.get("summary") instanceof String s)||s.isBlank()||s.length()>200||!(data.get("start") instanceof Map<?,?>)||!(data.get("end") instanceof Map<?,?>)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"제목과 시작·종료일을 입력하세요.");
        String requestId=input.get("requestId") instanceof String request?request:null;
        if(event==null&&requestId!=null){
            if(!requestId.matches("[0-9a-f]{32}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"일정 등록 식별자가 올바르지 않습니다.");
            data.put("id",requestId);
            try{return request(uid,"POST","/calendars/"+enc(calendar)+"/events",data,null);}
            catch(ResponseStatusException ex){if(ex.getStatusCode().value()!=409)throw ex;data.remove("id");return request(uid,"PATCH","/calendars/"+enc(calendar)+"/events/"+enc(requestId),data,null);}
        }
        return request(uid,event==null?"POST":"PATCH","/calendars/"+enc(calendar)+"/events"+(event==null?"":"/"+enc(event)),data,input.get("etag") instanceof String tag?tag:null);
    }
    public void deleteEvent(String uid,String calendar,String event,String etag) throws Exception {request(uid,"DELETE","/calendars/"+enc(calendar)+"/events/"+enc(event),null,etag);}
    private static String enc(String s){return URLEncoder.encode(s,StandardCharsets.UTF_8).replace("+","%20");}
}
