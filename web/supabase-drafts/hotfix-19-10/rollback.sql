-- Back to the race by every member: put the old functions back from
-- git show 3fce659:web/supabase-drafts/... is not enough (they were never in drafts);
-- use the definitions saved in hotfix-19-10/old_functions.sql, then:
select cron.unschedule('clan-war-reminder-start-batumi');
select cron.unschedule('clan-war-reminder-start-moscow');
select cron.unschedule('clan-war-reminder-last-batumi');
select cron.unschedule('clan-war-reminder-last-moscow');
-- (the tables clan_wars / clan_war_members can stay; nothing reads them in legacy mode)
