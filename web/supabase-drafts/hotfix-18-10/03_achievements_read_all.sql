-- Earned achievements stay unlocked on a profile even after the sectors behind
-- them are lost. The app reads user_achievements for that; until now a player
-- could only read their OWN rows, so someone else's profile showed the live
-- state. Achievements are already visible on every public profile, so reading
-- the (user, key, time) rows is open to signed-in players. Writes stay with the
-- server (_sync_achievements_for_user).
create policy "achievements readable by signed-in players" on public.user_achievements
  for select to authenticated using (true);
