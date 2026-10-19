import java.sql.*;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Explicit one-time provisioning; no password or token is stored in source or logs. */
public class CreateNoticePublisher {
    public static void main(String[] args)throws Exception {
        String login=System.getenv("NOTICE_LOGIN"),password=System.getenv("NOTICE_PASSWORD");
        if(login==null||password==null||login.isBlank()||password.isBlank())throw new IllegalArgumentException("NOTICE_LOGIN and NOTICE_PASSWORD are required.");
        String url=System.getenv().getOrDefault("DB_JDBC_URL","jdbc:postgresql://localhost:5432/travel_planner");
        String dbUser=System.getenv().getOrDefault("DB_USERNAME","postgres");
        try(var c=DriverManager.getConnection(url,dbUser,System.getenv("DB_PASSWORD"))){
            if(args.length==1&&args[0].equals("--verify")){
                try(var q=c.prepareStatement("select role,password from users where email=?")){q.setString(1,login);try(var rows=q.executeQuery()){
                    if(!rows.next()||!rows.getString(1).equals("NOTICE_PUBLISHER")||!new BCryptPasswordEncoder().matches(password,rows.getString(2)))throw new IllegalStateException("Publisher credential verification failed.");
                    System.out.println("Verified: notice-only role and BCrypt password match. Credentials were not printed.");return;
                }}
            }
            c.setAutoCommit(false);
            try {
                // Refuse to overwrite any existing account, including an existing publisher's password.
                try(var q=c.prepareStatement("select role from users where email=?")){q.setString(1,login);try(var rows=q.executeQuery()){if(rows.next())throw new IllegalStateException("Login already exists; no account was changed.");}}
                try(var s=c.createStatement()){s.execute(Files.readString(Path.of("src/main/resources/db/migration/V3__notice_publisher_role.sql")));}
                try(var s=c.prepareStatement("insert into users(user_id,email,password,nickname,provider,role,created_at) values(?,?,?,?, 'LOCAL','NOTICE_PUBLISHER',current_timestamp)")){
                    s.setString(1,UUID.randomUUID().toString().replace("-",""));s.setString(2,login);s.setString(3,new BCryptPasswordEncoder().encode(password));s.setString(4,"공지 관리자");s.executeUpdate();
                }
                c.commit();System.out.println("Notice-only account created. Password stored as BCrypt; existing accounts unchanged.");
            } catch(Exception e){c.rollback();throw e;}
        }
    }
}
