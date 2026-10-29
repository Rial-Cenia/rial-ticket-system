alter table public."Project"
add column description text not null default ''
check (char_length(description) <= 4000);
