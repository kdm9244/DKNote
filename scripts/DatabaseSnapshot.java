import java.sql.*;
import java.nio.file.*;
import java.io.*;
import java.util.*;

/** Local PostgreSQL snapshot using the application's JDBC driver; never deletes production data. */
public class DatabaseSnapshot {
    static Connection connect(String db)throws SQLException {
        String password=System.getenv("DB_PASSWORD");
        if(password==null||password.isBlank())throw new SQLException("DB_PASSWORD is required.");
        return DriverManager.getConnection("jdbc:postgresql://localhost:5432/"+db,"postgres",password);
    }
    static String identifier(String s){return '"'+s.replace("\"","\"\"")+'"';}
    static String table(String s){return "public."+identifier(s);}
    static String literal(String s){return "'"+s.replace("'","''")+"'";}
    static void backup(Path file)throws Exception {
        Path temp=file.resolveSibling(file.getFileName()+".partial");
        try(var c=connect("travel_planner")) {
            c.setAutoCommit(false);c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);c.setReadOnly(true);
            List<String> tables=new ArrayList<>();
            try(var s=c.createStatement();var r=s.executeQuery("select tablename from pg_tables where schemaname='public' order by tablename")){while(r.next())tables.add(r.getString(1));}
            // This application uses UUID/string keys. Fail explicitly for unsupported generated schemas.
            try(var s=c.createStatement();var r=s.executeQuery("select count(*) from pg_attribute a join pg_class t on t.oid=a.attrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relkind in('r','p') and a.attnum>0 and not a.attisdropped and (a.attidentity<>'' or a.attgenerated<>'')")){
                r.next();if(r.getInt(1)!=0)throw new SQLException("Generated columns require native PostgreSQL backup.");
            }
            try(var s=c.createStatement();var r=s.executeQuery("select count(*) from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relkind='S'")){
                r.next();if(r.getInt(1)!=0)throw new SQLException("Sequences require native PostgreSQL backup.");
            }
            try(var s=c.createStatement();var r=s.executeQuery("select count(*) from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and not g.tgisinternal")){
                r.next();if(r.getInt(1)!=0)throw new SQLException("Custom triggers require native PostgreSQL backup.");
            }
            try(var s=c.createStatement();var r=s.executeQuery("select count(*) from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relkind in('v','m','f')")){
                r.next();if(r.getInt(1)!=0)throw new SQLException("Views and foreign tables require native PostgreSQL backup.");
            }
            List<String> foreign=new ArrayList<>(),indexes=new ArrayList<>();long rows=0;
            Files.createDirectories(file.toAbsolutePath().getParent());
            try(var out=Files.newBufferedWriter(temp)) {
                out.write("-- Private application snapshot: schema, rows, constraints and indexes.\nBEGIN;\nSET standard_conforming_strings=on;\nSET search_path=public;\n");
                for(String name:tables) {
                    List<String> columns=new ArrayList<>();
                    try(var s=c.prepareStatement("select a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid) from pg_attribute a join pg_class t on t.oid=a.attrelid join pg_namespace n on n.oid=t.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and t.relname=? and a.attnum>0 and not a.attisdropped order by a.attnum")){
                        s.setString(1,name);try(var r=s.executeQuery()){while(r.next())columns.add(identifier(r.getString(1))+" "+r.getString(2)+(r.getString(4)==null?"":" DEFAULT "+r.getString(4))+(r.getBoolean(3)?" NOT NULL":""));}
                    }
                    try(var s=c.prepareStatement("select conname,contype,pg_get_constraintdef(p.oid) from pg_constraint p join pg_class t on t.oid=p.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=? order by conname")){
                        s.setString(1,name);try(var r=s.executeQuery()){while(r.next()){
                            String definition="CONSTRAINT "+identifier(r.getString(1))+" "+r.getString(3);
                            if("f".equals(r.getString(2)))foreign.add("ALTER TABLE "+table(name)+" ADD "+definition+";");else if(!"n".equals(r.getString(2)))columns.add(definition);
                        }}
                    }
                    out.write("CREATE TABLE "+table(name)+" ("+String.join(",",columns)+");\n");
                    try(var s=c.createStatement();var r=s.executeQuery("select row_to_json(t)::text from "+table(name)+" t")){
                        while(r.next()){out.write("INSERT INTO "+table(name)+" SELECT * FROM json_populate_record(NULL::"+table(name)+","+literal(r.getString(1))+"::json);\n");rows++;}
                    }
                    try(var s=c.prepareStatement("select pg_get_indexdef(i.indexrelid) from pg_index i join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=? and not exists(select 1 from pg_constraint p where p.conindid=i.indexrelid)")){
                        s.setString(1,name);try(var r=s.executeQuery()){while(r.next())indexes.add(r.getString(1)+";");}
                    }
                }
                for(String sql:foreign)out.write(sql+"\n");for(String sql:indexes)out.write(sql+"\n");out.write("COMMIT;\n");
            }
            c.commit();Files.move(temp,file,StandardCopyOption.REPLACE_EXISTING);
            System.out.println("Snapshot saved: "+tables.size()+" tables, "+rows+" rows. Private data was not printed.");
        }
    }
    static void verify(Path file)throws Exception {
        String db="travel_snapshot_verify_"+UUID.randomUUID().toString().replace("-","");
        try(var c=connect("postgres");var s=c.createStatement()){s.execute("CREATE DATABASE "+identifier(db));}
        try {
            try(var c=connect(db);var reader=Files.newBufferedReader(file);var s=c.createStatement()) {
                String line;int number=0;
                while((line=reader.readLine())!=null){number++;if(!line.isBlank()&&!line.startsWith("--")){try{s.execute(line);}catch(SQLException ex){throw new SQLException("Snapshot restore failed at statement "+number+".");}}}
            }
            System.out.println("PASS: snapshot schema, data, constraints and indexes restored into a fresh temporary database.");
        } finally {
            try(var c=connect("postgres");var s=c.createStatement()){s.execute("DROP DATABASE "+identifier(db));}
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=2||!Set.of("backup","verify").contains(args[0]))throw new IllegalArgumentException("Usage: DatabaseSnapshot.java backup|verify <private snapshot path>");
        if("backup".equals(args[0]))backup(Path.of(args[1]));else verify(Path.of(args[1]));
    }
}
