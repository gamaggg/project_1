-- Откат 07: шансы бокса снова 74 / 20 / 5 / 1 (как в 03).
create or replace function public._secret_box_roll() returns int language sql volatile as $$
  select case when r < 0.74 then 1 when r < 0.94 then 2 when r < 0.99 then 3 else 4 end from (select random() as r) x
$$;
revoke all on function public._secret_box_roll() from public, anon, authenticated;
