create table public.launch_subscribers (
 id uuid primary key default gen_random_uuid(),
 launch_key text not null check (launch_key = 'racing-57'),
 email text not null check (length(email)<=180),
 consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unsubscribed_at timestamptz,
 sent_at timestamptz,
 claimed_at timestamptz,
 attempts integer not null default 0,
 unique(launch_key,email)
);
alter table public.launch_subscribers enable row level security;
revoke all on public.launch_subscribers from public,anon,authenticated;
grant select,insert,update,delete on public.launch_subscribers to service_role;
create table public.launch_signup_limits (ip_hash text primary key, window_at timestamptz not null, requests integer not null);
alter table public.launch_signup_limits enable row level security;
revoke all on public.launch_signup_limits from public,anon,authenticated;
grant select,insert,update,delete on public.launch_signup_limits to service_role;
create function public.register_launch_alert(p_email text,p_ip_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.launch_signup_limits values(p_ip_hash,now(),1)
 on conflict(ip_hash) do update set requests=case when launch_signup_limits.window_at<now()-interval '1 hour' then 1 else launch_signup_limits.requests+1 end, window_at=case when launch_signup_limits.window_at<now()-interval '1 hour' then now() else launch_signup_limits.window_at end returning requests into n;
 if n>10 then return false; end if;
 insert into public.launch_subscribers(launch_key,email) values('racing-57',lower(trim(p_email))) on conflict(launch_key,email) do nothing;
 delete from public.launch_signup_limits where window_at<now()-interval '2 days';
 return true;
end $$;
revoke all on function public.register_launch_alert(text,text) from public,anon,authenticated;
grant execute on function public.register_launch_alert(text,text) to service_role;
create function public.claim_launch_alerts() returns setof public.launch_subscribers language sql security invoker set search_path='' as $$
 update public.launch_subscribers set claimed_at=now(),attempts=attempts+1
 where id in (select id from public.launch_subscribers where launch_key='racing-57' and sent_at is null and unsubscribed_at is null and attempts<5 and (claimed_at is null or claimed_at<now()-interval '15 minutes') order by created_at for update skip locked limit 15) returning *;
$$;
revoke all on function public.claim_launch_alerts() from public,anon,authenticated;
grant execute on function public.claim_launch_alerts() to service_role;
