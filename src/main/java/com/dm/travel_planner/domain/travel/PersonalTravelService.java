package com.dm.travel_planner.domain.travel;

import com.dm.travel_planner.domain.trip.entity.*;
import com.dm.travel_planner.domain.trip.repository.*;
import com.dm.travel_planner.domain.activity.entity.*;
import com.dm.travel_planner.domain.activity.repository.ActivityRepository;
import com.dm.travel_planner.domain.budget.entity.BudgetItem;
import com.dm.travel_planner.domain.budget.repository.BudgetItemRepository;
import com.dm.travel_planner.domain.checklist.entity.*;
import com.dm.travel_planner.domain.checklist.repository.ChecklistItemRepository;
import com.dm.travel_planner.domain.checklist.service.ChecklistService;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.math.*;
import static com.dm.travel_planner.domain.travel.TravelRequests.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class PersonalTravelService {
    private final TripRepository trips;
    private final DayRepository days;
    private final ActivityRepository activities;
    private final BudgetItemRepository expenses;
    private final TravelPlaceRepository places;
    private final TravelReservationRepository reservations;
    private final ChecklistItemRepository checklistItems;
    private final ChecklistService checklist;
    private final UserRepository users;
    static ResponseStatusException bad(String text){return new ResponseStatusException(HttpStatus.BAD_REQUEST,text);}
    static ResponseStatusException missing(){return new ResponseStatusException(HttpStatus.NOT_FOUND,"여행 항목을 찾을 수 없습니다.");}
    static void version(Number expected,Number actual){
        if(expected==null)throw bad("저장 버전이 필요합니다.");
        if(expected.longValue()!=actual.longValue())throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 화면에서 수정되었습니다. 새로고침 후 다시 저장해 주세요.");
    }
    public Trip owned(String id,String uid){
        var t=trips.findById(id).orElseThrow(PersonalTravelService::missing);
        if(!Objects.equals(t.getOwnerId(),uid))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"내 여행만 확인할 수 있습니다.");
        return t;
    }
    private Trip locked(String id,String uid){
        var t=trips.lockById(id).orElseThrow(PersonalTravelService::missing);
        if(!Objects.equals(t.getOwnerId(),uid))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"내 여행만 수정할 수 있습니다.");
        return t;
    }
    public List<Map<String,Object>> list(String uid){return trips.findByOwnerIdOrderByStartDateDesc(uid).stream().map(this::tripRow).toList();}
    public Map<String,Object> detail(String id,String uid){
        var t=owned(id,uid);
        return row("trip",tripRow(t),"days",days.findByTrip_TripIdOrderByDayNumberAsc(id).stream().map(d->row(
            "id",d.getDayId(),"date",d.getTravelDate(),"number",d.getDayNumber(),"activities",activities.findByDay_DayIdOrderBySequenceAsc(d.getDayId()).stream().map(this::activityRow).toList())).toList(),
            "places",places.findByTrip_TripIdOrderByTitleAsc(id).stream().map(this::placeRow).toList(),
            "reservations",reservations.findByTrip_TripIdOrderByStartsAtAsc(id).stream().map(this::reservationRow).toList(),
            "expenses",expenses.findByTrip_TripIdOrderByExpenseDateDescCreatedAtDesc(id).stream().map(this::expenseRow).toList(),
            "checklist",checklist.getChecklist(id,"ALL",uid),"budget",budget(id),"legacyArchive",t.getLegacyArchive());
    }
    @Transactional public Map<String,Object> saveTrip(String id,TripDraft r,String uid){
        long length=ChronoUnit.DAYS.between(r.startDate(),r.endDate())+1;
        if(length<1||length>366)throw bad("여행 기간은 1~366일로 지정해 주세요.");
        try{ZoneId.of(r.timezone());}catch(Exception e){throw bad("유효한 여행 시간대를 선택해 주세요.");}
        var t=id==null?Trip.builder().ownerId(uid).build():locked(id,uid);
        if(id!=null)version(r.version(),t.getVersion());
        var existing=id==null?new ArrayList<Day>():new ArrayList<>(days.findByTrip_TripIdOrderByDayNumberAsc(id));
        // Preserve dates that still exist; never silently remove a populated day.
        for(var d:existing)if(d.getTravelDate().isBefore(r.startDate())||d.getTravelDate().isAfter(r.endDate()))
            if(!activities.findByDay_DayIdOrderBySequenceAsc(d.getDayId()).isEmpty())throw bad("제외되는 날짜에 일정이 있습니다. 먼저 다른 날짜로 옮겨 주세요.");
        t.setTitle(r.title().trim());t.setStartDate(r.startDate());t.setEndDate(r.endDate());
        t.setDestination(r.destination());t.setDescription(r.description());t.setNotes(r.notes());t.setTimezone(r.timezone());t.setCustomTargetBudget(r.targetBudget());
        trips.saveAndFlush(t);
        for(var d:existing)if(d.getTravelDate().isBefore(r.startDate())||d.getTravelDate().isAfter(r.endDate())){t.getDays().removeIf(x->x.getDayId().equals(d.getDayId()));days.delete(d);}
        for(int n=0;n<length;n++){
            LocalDate date=r.startDate().plusDays(n);
            var d=existing.stream().filter(x->x.getTravelDate().equals(date)).findFirst().orElse(null);
            if(d==null){d=Day.builder().trip(t).travelDate(date).dayNumber(n+1).build();t.getDays().add(d);days.save(d);}else d.setDayNumber(n+1);
        }
        trips.flush();return tripRow(t);
    }
    @Transactional public Map<String,Object> importLegacy(String id,LegacyDraft r,String uid){
        var t=locked(id,uid);version(r.version(),t.getVersion());
        if((t.getNotes()==null||t.getNotes().isBlank())&&r.notes()!=null)t.setNotes(r.notes());
        if(r.archive()!=null){
            var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
            var merged=mapper.createObjectNode();
            if(t.getLegacyArchive()!=null){
                try{var old=mapper.readTree(t.getLegacyArchive());if(old.isObject())merged.setAll((com.fasterxml.jackson.databind.node.ObjectNode)old);else merged.put("priorArchiveText",t.getLegacyArchive());}
                catch(com.fasterxml.jackson.core.JsonProcessingException e){merged.put("priorArchiveText",t.getLegacyArchive());}
            }
            try{
                var incoming=mapper.readTree(r.archive());if(incoming==null||!incoming.isObject())throw bad("이전 자료 형식을 확인해 주세요.");
                incoming.fields().forEachRemaining(e->{if(!merged.has(e.getKey()))merged.set(e.getKey(),e.getValue());});
                String combined=mapper.writeValueAsString(merged);if(combined.length()>2000000)throw bad("이전 자료가 큽니다. 원본 기록을 파일로 보존해 주세요.");
                t.setLegacyArchive(combined);
            }catch(com.fasterxml.jackson.core.JsonProcessingException e){throw bad("이전 자료 형식을 확인해 주세요.");}
        }
        trips.flush();return tripRow(t);
    }
    @Transactional public void deleteTrip(String id,int v,String uid){
        var t=locked(id,uid);version(v,t.getVersion());
        reservations.deleteAll(reservations.findByTrip_TripIdOrderByStartsAtAsc(id));
        places.deleteAll(places.findByTrip_TripIdOrderByTitleAsc(id));
        expenses.deleteAll(expenses.findByTrip_TripIdOrderByExpenseDateDescCreatedAtDesc(id));
        for(var item:checklistItems.findByTrip_TripIdOrderByCategoryAscSequenceAscCreatedAtAsc(id))checklist.deleteItem(item.getItemId(),uid);
        trips.delete(t);trips.flush();
    }
    private Activity activity(String id,String uid){var a=activities.findById(id).orElseThrow(PersonalTravelService::missing);owned(a.getDay().getTrip().getTripId(),uid);return a;}
    @Transactional public Map<String,Object> saveActivity(String dayId,String id,ActivityDraft r,String uid){
        var d=days.findById(dayId).orElseThrow(PersonalTravelService::missing);locked(d.getTrip().getTripId(),uid);
        var a=id==null?Activity.builder().day(d).sequence(activities.findByDay_DayIdOrderBySequenceAsc(dayId).size()).build():activity(id,uid);
        if(!a.getDay().getDayId().equals(dayId))throw bad("일정 날짜가 일치하지 않습니다.");
        if(id!=null)version(r.version(),a.getVersion());
        if((r.startTime()==null)!=(r.endTime()==null))throw bad("시작·종료 시간을 함께 입력하거나 둘 다 비워 주세요.");
        if(r.startTime()!=null&&!r.endTime().isAfter(r.startTime()))throw bad("종료 시간이 시작 시간보다 늦어야 합니다. 자정을 넘는 일정은 날짜별로 나눠 주세요.");
        ActivityType type;try{type=ActivityType.valueOf(r.type());}catch(Exception e){throw bad("일정 종류를 확인해 주세요.");}
        checkCurrency(r.currency());
        if(type==ActivityType.TRANSPORT&&(r.departureLocation()==null||r.departureLocation().isBlank()||r.arrivalLocation()==null||r.arrivalLocation().isBlank()))throw bad("이동 일정에는 출발지와 도착지가 필요합니다.");
        a.setTitle(r.title().trim());a.setActivityType(type);a.setStartTime(r.startTime());a.setEndTime(r.endTime());a.setLocation(r.location());
        a.setDepartureLocation(r.departureLocation());a.setArrivalLocation(r.arrivalLocation());a.setShortIntro(r.memo());a.setCost(r.cost());
        a.setCurrency(r.currency());a.setFxRate("KRW".equals(r.currency())?BigDecimal.ONE:r.fxRate());a.setTravelMinutes(r.travelMinutes());
        if(id==null)d.getActivities().add(a);
        activities.saveAndFlush(a);return activityRow(a);
    }
    @Transactional public void move(String id,Move r,String uid){
        var a=activity(id,uid);locked(a.getDay().getTrip().getTripId(),uid);version(r.version(),a.getVersion());
        var d=days.findById(r.dayId()).orElseThrow(PersonalTravelService::missing);
        if(!d.getTrip().getTripId().equals(a.getDay().getTrip().getTripId()))throw bad("같은 여행의 날짜로만 이동할 수 있습니다.");
        var old=activities.findByDay_DayIdOrderBySequenceAsc(a.getDay().getDayId());old.removeIf(x->x.getActivityId().equals(id));
        var target=d.getDayId().equals(a.getDay().getDayId())?old:new ArrayList<>(activities.findByDay_DayIdOrderBySequenceAsc(d.getDayId()));
        if(r.index()>target.size())throw bad("일정 순서가 변경되었습니다. 새로고침해 주세요.");
        if(!d.getDayId().equals(a.getDay().getDayId())){a.getDay().getActivities().removeIf(x->x.getActivityId().equals(id));d.getActivities().add(a);}
        a.setDay(d);target.add(r.index(),a);for(int i=0;i<old.size();i++)old.get(i).setSequence(i);for(int i=0;i<target.size();i++)target.get(i).setSequence(i);
        activities.flush();
    }
    @Transactional public void deleteActivity(String id,long v,String uid){
        var a=activity(id,uid);locked(a.getDay().getTrip().getTripId(),uid);version(v,a.getVersion());
        for(var b:reservations.findByTrip_TripIdOrderByStartsAtAsc(a.getDay().getTrip().getTripId()))if(id.equals(b.getActivityId()))b.setActivityId(null);
        a.getDay().getActivities().removeIf(x->x.getActivityId().equals(id));activities.delete(a);activities.flush();
    }
    @Transactional public Map<String,Object> savePlace(String tripId,String id,PlaceDraft r,String uid){
        var t=locked(tripId,uid);checkUrl(r.url());var p=id==null?new TravelPlace():places.findById(id).orElseThrow(PersonalTravelService::missing);
        if(id!=null){if(!p.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(r.version(),p.getVersion());}
        else {p.setId(UUID.randomUUID().toString());p.setTrip(t);}
        p.setTitle(r.title().trim());p.setAddress(r.address());p.setUrl(r.url());p.setMemo(r.memo());places.saveAndFlush(p);return placeRow(p);
    }
    @Transactional public void deletePlace(String tripId,String id,long v,String uid){locked(tripId,uid);var p=places.findById(id).orElseThrow(PersonalTravelService::missing);if(!p.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(v,p.getVersion());places.delete(p);}
    @Transactional public Map<String,Object> saveReservation(String tripId,String id,ReservationDraft r,String uid){
        var t=locked(tripId,uid);checkUrl(r.url());
        if(!Set.of("FLIGHT","HOTEL","TICKET","OTHER").contains(r.type())||!Set.of("PLANNED","BOOKED","CANCELLED").contains(r.status()))throw bad("예약 종류와 상태를 확인해 주세요.");
        if(r.endsAt()!=null&&(r.startsAt()==null||r.endsAt().isBefore(r.startsAt())))throw bad("예약 종료 일시를 확인해 주세요.");
        if(r.activityId()!=null&&!r.activityId().isBlank())if(!activity(r.activityId(),uid).getDay().getTrip().getTripId().equals(tripId))throw bad("다른 여행의 일정입니다.");
        var b=id==null?new TravelReservation():reservations.findById(id).orElseThrow(PersonalTravelService::missing);
        if(id!=null){if(!b.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(r.version(),b.getVersion());}
        else {
            b.setId(UUID.randomUUID().toString());b.setTrip(t);
            var u=users.findById(uid).orElseThrow(PersonalTravelService::missing);
            var fileItem=ChecklistItem.builder().trip(t).title(r.title()).category("예약 자료").scope(ChecklistScope.PERSONAL).owner(u).createdBy(u).build();
            checklistItems.saveAndFlush(fileItem);b.setAttachmentItemId(fileItem.getItemId());
        }
        b.setTitle(r.title().trim());b.setType(r.type());b.setStatus(r.status());b.setAddress(r.address());b.setConfirmation(r.confirmation());b.setUrl(r.url());b.setMemo(r.memo());
        b.setStartsAt(r.startsAt());b.setEndsAt(r.endsAt());b.setCancelBy(r.cancelBy());b.setActivityId(r.activityId()==null||r.activityId().isBlank()?null:r.activityId());
        checklistItems.findById(b.getAttachmentItemId()).ifPresent(i->i.setTitle(r.title().trim()));
        reservations.saveAndFlush(b);return reservationRow(b);
    }
    @Transactional public void deleteReservation(String tripId,String id,long v,String uid){
        locked(tripId,uid);var b=reservations.findById(id).orElseThrow(PersonalTravelService::missing);if(!b.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(v,b.getVersion());
        // Keep attached files as a normal checklist item when removing a reservation.
        checklistItems.findById(b.getAttachmentItemId()).ifPresent(i->i.setCategory("서류·티켓"));reservations.delete(b);
    }
    @Transactional public Map<String,Object> saveExpense(String tripId,String id,ExpenseDraft r,String uid){
        var t=locked(tripId,uid);checkCurrency(r.currency());var e=id==null?BudgetItem.builder().trip(t).build():expenses.findById(id).orElseThrow(PersonalTravelService::missing);
        if(id!=null){if(!e.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(r.version(),e.getVersion());}
        e.setTitle(r.title().trim());e.setCategory(r.category());e.setAmount(r.amount());e.setCurrency(r.currency());e.setFxRate("KRW".equals(r.currency())?BigDecimal.ONE:r.fxRate());
        e.setExpenseDate(r.date());e.setPaymentMethod(r.paymentMethod());e.setMemo(r.memo());expenses.saveAndFlush(e);return expenseRow(e);
    }
    @Transactional public void deleteExpense(String tripId,String id,long v,String uid){locked(tripId,uid);var e=expenses.findById(id).orElseThrow(PersonalTravelService::missing);if(!e.getTrip().getTripId().equals(tripId))throw bad("여행이 일치하지 않습니다.");version(v,e.getVersion());expenses.delete(e);}
    private void checkCurrency(String c){if(!Set.of("KRW","JPY","USD","EUR","CNY","GBP","TWD").contains(c))throw bad("지원하는 통화를 선택해 주세요.");}
    private void checkUrl(String s){if(s!=null&&!s.isBlank()){try{var uri=java.net.URI.create(s);if(!("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))||uri.getHost()==null)throw bad("http 또는 https 링크만 사용할 수 있습니다.");}catch(IllegalArgumentException e){throw bad("링크 주소를 확인해 주세요.");}}}
    private Map<String,Object> budget(String id){
        BigDecimal actual=BigDecimal.ZERO,planned=BigDecimal.ZERO;boolean actualKnown=true,plannedKnown=true;var nativeTotals=new TreeMap<String,BigDecimal>();
        for(var e:expenses.findByTrip_TripIdOrderByExpenseDateDescCreatedAtDesc(id)){
            nativeTotals.merge(e.getCurrency(),e.getAmount(),BigDecimal::add);var fx="KRW".equals(e.getCurrency())?BigDecimal.ONE:e.getFxRate();
            if(fx==null&&e.getAmount().signum()!=0)actualKnown=false;else if(fx!=null)actual=actual.add(e.getAmount().multiply(fx));
        }
        for(var d:days.findByTrip_TripIdOrderByDayNumberAsc(id))for(var a:activities.findByDay_DayIdOrderBySequenceAsc(d.getDayId())){
            var fx="KRW".equals(a.getCurrency())?BigDecimal.ONE:a.getFxRate();if(fx==null&&a.getCost().signum()!=0)plannedKnown=false;else if(fx!=null)planned=planned.add(a.getCost().multiply(fx));
        }
        return row("actualKrw",actualKnown?actual.setScale(0,RoundingMode.HALF_UP):null,"plannedKrw",plannedKnown?planned.setScale(0,RoundingMode.HALF_UP):null,"nativeTotals",nativeTotals);
    }
    private Map<String,Object> tripRow(Trip t){LocalDate today=LocalDate.now(ZoneId.of(t.getTimezone()));return row("id",t.getTripId(),"title",t.getTitle(),"destination",t.getDestination(),"description",t.getDescription(),"notes",t.getNotes(),"startDate",t.getStartDate(),"endDate",t.getEndDate(),"timezone",t.getTimezone(),"targetBudget",t.getCustomTargetBudget(),"version",t.getVersion(),"status",today.isBefore(t.getStartDate())?"계획 중":today.isAfter(t.getEndDate())?"여행 완료":"여행 중");}
    private Map<String,Object> activityRow(Activity a){return row("id",a.getActivityId(),"dayId",a.getDay().getDayId(),"title",a.getTitle(),"type",a.getActivityType(),"startTime",a.getStartTime(),"endTime",a.getEndTime(),"location",a.getLocation(),"departureLocation",a.getDepartureLocation(),"arrivalLocation",a.getArrivalLocation(),"memo",a.getShortIntro(),"cost",a.getCost(),"currency",a.getCurrency(),"fxRate",a.getFxRate(),"travelMinutes",a.getTravelMinutes(),"version",a.getVersion());}
    private Map<String,Object> placeRow(TravelPlace p){return row("id",p.getId(),"title",p.getTitle(),"address",p.getAddress(),"url",p.getUrl(),"memo",p.getMemo(),"version",p.getVersion());}
    private Map<String,Object> reservationRow(TravelReservation b){return row("id",b.getId(),"title",b.getTitle(),"type",b.getType(),"status",b.getStatus(),"address",b.getAddress(),"confirmation",b.getConfirmation(),"url",b.getUrl(),"memo",b.getMemo(),"startsAt",b.getStartsAt(),"endsAt",b.getEndsAt(),"cancelBy",b.getCancelBy(),"activityId",b.getActivityId(),"attachmentItemId",b.getAttachmentItemId(),"version",b.getVersion());}
    private Map<String,Object> expenseRow(BudgetItem e){return row("id",e.getBudgetId(),"title",e.getTitle(),"category",e.getCategory(),"amount",e.getAmount(),"currency",e.getCurrency(),"fxRate",e.getFxRate(),"date",e.getExpenseDate(),"paymentMethod",e.getPaymentMethod(),"memo",e.getMemo(),"version",e.getVersion());}
    private static Map<String,Object> row(Object... fields){var map=new LinkedHashMap<String,Object>();for(int i=0;i<fields.length;i+=2)map.put((String)fields[i],fields[i+1]);return map;}
}
