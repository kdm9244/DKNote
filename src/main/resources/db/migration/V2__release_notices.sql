create table release_notices (
    id varchar(36) primary key,
    title varchar(200) not null,
    release_version varchar(40) not null,
    body text not null,
    author_id varchar(50) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    version bigint
);
create index idx_release_notices_created on release_notices(created_at);
