package com.dm.travel_planner.domain.user.repository;

import com.dm.travel_planner.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    /**
     * 이메일로 사용자 정보를 단건 조회합니다.
     * 로그인 및 소셜 로그인 연동 시 사용자의 존재 여부를 파악할 때 쓰입니다.
     */
    Optional<User> findByEmail(String email);

    /**
     * 입력한 이메일이 이미 데이터베이스에 등록되어 있는지 여부를 확인합니다.
     * 회원가입 시 중복 가입 방지를 위한 유효성 검사에 사용됩니다.
     */
    boolean existsByEmail(String email);
}
