package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.domain.user.entity.*;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import static com.dm.travel_planner.domain.travel.TravelRequests.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(properties="market-data.sync-initial-delay-ms=3600000") @Transactional
class PersonalTravelTest {
    @Autowired PersonalTravelService service;
    @Autowired UserRepository users;
    String uid;
    @BeforeEach void setup(){uid="travel_qa_"+UUID.randomUUID();users.saveAndFlush(User.builder().userId(uid).email(uid+"@example.test").nickname("여행 검증").provider(AuthProvider.LOCAL).role(UserRole.USER).build());}
    TripDraft draft(LocalDate start,LocalDate end,Integer v){return new TripDraft("교토 여행",start,end,"교토","테스트","메모","Asia/Tokyo",100000,v);}
    Map<String,Object> trip(){return service.saveTrip(null,draft(LocalDate.of(2026,11,1),LocalDate.of(2026,11,3),null),uid);}
    @SuppressWarnings("unchecked") List<Map<String,Object>> dayRows(String id){return (List<Map<String,Object>>)service.detail(id,uid).get("days");}
    ActivityDraft activity(Long v,String c,BigDecimal rate){return new ActivityDraft("산책","SPOT",LocalTime.of(10,0),LocalTime.of(11,0),"교토역","","","메모",new BigDecimal("3000"),c,rate,15,v);}
    @Test void onlyOwnerCanSeeAndEditTrips(){var t=trip();String id=(String)t.get("id");assertEquals(1,service.list(uid).size());assertEquals(403,assertThrows(ResponseStatusException.class,()->service.detail(id,"other")).getStatusCode().value());assertEquals(403,assertThrows(ResponseStatusException.class,()->service.savePlace(id,null,new PlaceDraft("장소","","","",null),"other")).getStatusCode().value());}
    @Test void movePreservesActivityAndRejectsOtherTrip(){var t=trip();String id=(String)t.get("id");var ds=dayRows(id);var a=service.saveActivity((String)ds.get(0).get("id"),null,activity(null,"KRW",null),uid);service.move((String)a.get("id"),new Move((String)ds.get(1).get("id"),0,((Number)a.get("version")).longValue()),uid);assertTrue(((List<?>)dayRows(id).get(0).get("activities")).isEmpty());assertEquals(1,((List<?>)dayRows(id).get(1).get("activities")).size());var second=trip();String foreignDay=(String)dayRows((String)second.get("id")).get(0).get("id");assertThrows(ResponseStatusException.class,()->service.move((String)a.get("id"),new Move(foreignDay,0,1L),uid));}
    @Test void shrinkingDatesNeverSilentlyDeletesAnActivity(){var t=trip();String id=(String)t.get("id");String day=(String)dayRows(id).get(2).get("id");service.saveActivity(day,null,activity(null,"KRW",null),uid);int v=((Number)t.get("version")).intValue();assertThrows(ResponseStatusException.class,()->service.saveTrip(id,draft(LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),v),uid));assertEquals(3,dayRows(id).size());}
    @Test @SuppressWarnings("unchecked") void foreignExpensesKeepOriginalAmountAndRequireRateForTotal(){var t=trip();String id=(String)t.get("id");var e=service.saveExpense(id,null,new ExpenseDraft("식사","식비",new BigDecimal("100.50"),"JPY",null,LocalDate.of(2026,11,1),"CASH","",null),uid);var b=(Map<String,Object>)service.detail(id,uid).get("budget");assertNull(b.get("actualKrw"));assertEquals(new BigDecimal("100.50"),((Map<String,BigDecimal>)b.get("nativeTotals")).get("JPY"));service.saveExpense(id,(String)e.get("id"),new ExpenseDraft("식사","식비",new BigDecimal("100.50"),"JPY",new BigDecimal("9"),LocalDate.of(2026,11,1),"CASH","",((Number)e.get("version")).longValue()),uid);b=(Map<String,Object>)service.detail(id,uid).get("budget");assertEquals(new BigDecimal("905"),b.get("actualKrw"));}
    @Test void reservationOwnsFileItemAndUnlinksWhenActivityDeleted(){var t=trip();String id=(String)t.get("id");var a=service.saveActivity((String)dayRows(id).get(0).get("id"),null,activity(null,"KRW",null),uid);var b=service.saveReservation(id,null,new ReservationDraft("숙소","HOTEL","BOOKED","교토","ABC","https://example.test","",LocalDateTime.of(2026,11,1,15,0),LocalDateTime.of(2026,11,2,10,0),null,(String)a.get("id"),null),uid);assertNotNull(b.get("attachmentItemId"));service.deleteActivity((String)a.get("id"),0,uid);var detail=service.detail(id,uid);assertTrue(((List<?>)detail.get("checklist")).size()>0);service.deleteReservation(id,(String)b.get("id"),1,uid);assertEquals(1,((List<?>)service.detail(id,uid).get("checklist")).size());}
    @Test void staleSavesAndUnsafeLinksAreRejected(){var t=trip();String id=(String)t.get("id");var p=service.savePlace(id,null,new PlaceDraft("맛집","교토","https://example.test","",null),uid);service.savePlace(id,(String)p.get("id"),new PlaceDraft("맛집 수정","교토","https://example.test","",0L),uid);assertEquals(409,assertThrows(ResponseStatusException.class,()->service.savePlace(id,(String)p.get("id"),new PlaceDraft("오래된 수정","","","",0L),uid)).getStatusCode().value());assertThrows(ResponseStatusException.class,()->service.savePlace(id,null,new PlaceDraft("위험 링크","","javascript:alert(1)","",null),uid));}
    @Test void deletingOwnedTripRemovesChildrenAndPreservesOtherTrips(){var t=trip();String id=(String)t.get("id");var other=trip();service.saveActivity((String)dayRows(id).get(0).get("id"),null,activity(null,"KRW",null),uid);service.savePlace(id,null,new PlaceDraft("맛집","","","",null),uid);service.saveReservation(id,null,new ReservationDraft("숙소","HOTEL","BOOKED","","","","",null,null,null,null,null),uid);service.deleteTrip(id,((Number)t.get("version")).intValue(),uid);assertEquals(1,service.list(uid).size());assertNotNull(service.detail((String)other.get("id"),uid));assertThrows(ResponseStatusException.class,()->service.detail(id,uid));}
    @Test void browserArchiveMergesWithExistingDatabaseArchiveWithoutOverwritingRecords(){
        var t=trip();String id=(String)t.get("id");
        var first=service.importLegacy(id,new LegacyDraft(null,"{\"databaseRecord\":\"keep\"}",((Number)t.get("version")).intValue()),uid);
        var second=service.importLegacy(id,new LegacyDraft("브라우저 메모","{\"browserPhotos\":[\"photo\"],\"databaseRecord\":\"overwrite\"}",((Number)first.get("version")).intValue()),uid);
        String archive=(String)service.detail(id,uid).get("legacyArchive");assertTrue(archive.contains("browserPhotos"));assertTrue(archive.contains("keep"));assertFalse(archive.contains("overwrite"));
        service.importLegacy(id,new LegacyDraft(null,"{\"browserPhotos\":[\"photo\"]}",((Number)second.get("version")).intValue()),uid);assertEquals(archive,service.detail(id,uid).get("legacyArchive"));
    }
}
