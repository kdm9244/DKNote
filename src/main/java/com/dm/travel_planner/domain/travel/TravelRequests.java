package com.dm.travel_planner.domain.travel;
import jakarta.validation.constraints.*;
import java.time.*;
import java.math.BigDecimal;
public final class TravelRequests {
    private TravelRequests() {}
    public record TripDraft(@NotBlank @Size(max=100) String title,@NotNull LocalDate startDate,@NotNull LocalDate endDate,
        @Size(max=200) String destination,@Size(max=255) String description,@Size(max=10000) String notes,
        @NotBlank @Size(max=60) String timezone,@Min(0) Integer targetBudget,Integer version) {}
    public record ActivityDraft(@NotBlank @Size(max=100) String title,@NotBlank String type,LocalTime startTime,LocalTime endTime,
        @Size(max=200) String location,@Size(max=200) String departureLocation,@Size(max=200) String arrivalLocation,
        @Size(max=10000) String memo,@NotNull @DecimalMin("0") @DecimalMax("1000000000") @Digits(integer=10,fraction=2) BigDecimal cost,
        @NotBlank String currency,@DecimalMin("0.000001") @DecimalMax("1000000000") BigDecimal fxRate,
        @Min(0) @Max(1440) int travelMinutes,Long version) {}
    public record Move(@NotBlank String dayId,@Min(0) int index,@NotNull Long version) {}
    public record PlaceDraft(@NotBlank @Size(max=100) String title,@Size(max=200) String address,
        @Size(max=500) String url,@Size(max=10000) String memo,Long version) {}
    public record ReservationDraft(@NotBlank @Size(max=100) String title,@NotBlank String type,@NotBlank String status,
        @Size(max=200) String address,@Size(max=100) String confirmation,@Size(max=500) String url,@Size(max=10000) String memo,
        LocalDateTime startsAt,LocalDateTime endsAt,LocalDateTime cancelBy,@Size(max=50) String activityId,Long version) {}
    public record ExpenseDraft(@NotBlank @Size(max=100) String title,@NotBlank @Size(max=50) String category,
        @NotNull @DecimalMin("0") @DecimalMax("1000000000") @Digits(integer=10,fraction=2) BigDecimal amount,@NotBlank String currency,
        @DecimalMin("0.000001") @DecimalMax("1000000000") BigDecimal fxRate,@NotNull LocalDate date,
        @Size(max=50) String paymentMethod,@Size(max=10000) String memo,Long version) {}
    public record LegacyDraft(@Size(max=10000) String notes,@Size(max=2000000) String archive,Integer version) {}
}
