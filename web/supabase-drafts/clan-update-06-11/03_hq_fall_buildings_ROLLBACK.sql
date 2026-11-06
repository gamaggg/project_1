-- Rollback of 03_hq_fall_buildings.sql: drops what it adds and puts the part 02 versions of the replaced functions back
-- (re-run clan_hq_place, clan_hq_attack, clan_hq_tick from 02_buff_hq.sql and _clan_treasury_cap from 01_treasury.sql).
drop function if exists public.clan_upgrade_project(text);
drop function if exists public._clan_project_level(bigint, text);
drop table if exists public.clan_hq_ruins;
alter table public.clan_hq drop column if exists defense_at;
-- Then re-create: _clan_treasury_cap (01), clan_hq_place / clan_hq_attack / clan_hq_tick (02).
-- Buildings already bought stay in clan_treasury.projects, extra_slots already added to clans stay (take them back by hand if wanted).
