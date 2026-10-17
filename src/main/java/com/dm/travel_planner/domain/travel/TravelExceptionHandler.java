package com.dm.travel_planner.domain.travel;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.Map;
@RestControllerAdvice(assignableTypes=PersonalTravelController.class)
public class TravelExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<?> status(ResponseStatusException e){return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason()==null?"요청을 처리할 수 없습니다.":e.getReason()));}
    @ExceptionHandler(OptimisticLockingFailureException.class) public ResponseEntity<?> conflict(){return ResponseEntity.status(409).body(Map.of("message","다른 화면에서 수정되었습니다. 새로고침 후 다시 저장해 주세요."));}
    @ExceptionHandler(MethodArgumentNotValidException.class) public ResponseEntity<?> validation(){return ResponseEntity.badRequest().body(Map.of("message","입력값과 글자 수를 확인해 주세요."));}
}
