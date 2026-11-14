-- Harden task approval against concurrent duplicate rewards.
-- Apply this migration in the Supabase SQL Editor before relying on this fix.

begin;

create or replace function public.approve_streetlife_task(
  p_submission_id uuid,
  p_admin_telegram_id text
)
returns table(success boolean, message text, credited integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_submission public.task_submissions%rowtype;
  v_player_id bigint;
begin
  -- Serialize review of this exact submission.
  select *
    into v_submission
  from public.task_submissions
  where id = p_submission_id
  for update;

  if not found then
    return query select false, 'Submission not found', 0;
    return;
  end if;

  if v_submission.status <> 'pending' then
    return query select false, 'Submission is no longer pending', 0;
    return;
  end if;

  if v_submission.reward is null or v_submission.reward <= 0 then
    return query select false, 'Submission has an invalid reward amount', 0;
    return;
  end if;

  -- Lock the player's account row so two different submissions for the
  -- same player cannot both pass the duplicate-task check concurrently.
  select id
    into v_player_id
  from public.players
  where telegram_id::text = v_submission.player_telegram_id
  for update;

  if not found then
    return query select false, 'Player account not found', 0;
    return;
  end if;

  if exists (
    select 1
    from public.task_submissions
    where player_telegram_id = v_submission.player_telegram_id
      and task_key = v_submission.task_key
      and status = 'approved'
      and id <> p_submission_id
  ) then
    return query select false, 'This task has already been rewarded', 0;
    return;
  end if;

  update public.players
  set coins = coalesce(coins, 0) + v_submission.reward
  where id = v_player_id;

  update public.task_submissions
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by_telegram_id = p_admin_telegram_id,
      denial_reason = null
  where id = p_submission_id;

  insert into public.task_coin_transactions
    (submission_id, player_telegram_id, amount, description)
  values
    (p_submission_id, v_submission.player_telegram_id,
     v_submission.reward, 'Approved task: ' || v_submission.task_key);

  return query select true, 'Task approved and coins credited', v_submission.reward;
end;
$function$;

-- These RPCs are called only by the authenticated Next.js server using the
-- Supabase service-role key. Do not expose SECURITY DEFINER execution to clients.
revoke all on function public.approve_streetlife_task(uuid, text) from public;
revoke all on function public.approve_streetlife_task(uuid, text) from anon;
revoke all on function public.approve_streetlife_task(uuid, text) from authenticated;
grant execute on function public.approve_streetlife_task(uuid, text) to service_role;

revoke all on function public.reject_streetlife_task(uuid, text, text) from public;
revoke all on function public.reject_streetlife_task(uuid, text, text) from anon;
revoke all on function public.reject_streetlife_task(uuid, text, text) from authenticated;
grant execute on function public.reject_streetlife_task(uuid, text, text) to service_role;

commit;
