package com.dm.travel_planner.domain.workspace;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import java.util.Map;

@RestControllerAdvice(basePackages = "com.dm.travel_planner.domain.workspace")
public class WorkspaceExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> status(ResponseStatusException e) {return ResponseEntity.status(e.getStatusCode()).body(Map.of("message",e.getReason() == null ? "요청을 처리할 수 없습니다." : e.getReason()));}
    @ExceptionHandler({ObjectOptimisticLockingFailureException.class,DataIntegrityViolationException.class})
    public ResponseEntity<?> conflict(Exception e) {return ResponseEntity.status(409).body(Map.of("message","데이터가 변경되었습니다. 새로고침 후 다시 시도하세요."));}
}
