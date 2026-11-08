create table if not exists public.responses (
    id bigint generated always as identity primary key,
    session_id uuid not null,
    created_at timestamptz not null default now(),
    question text not null,
    answer text not null
);

alter table public.responses enable row level security;

revoke all on public.responses from anon, authenticated;
grant insert (session_id, question, answer) on public.responses to anon;
grant select on public.responses to authenticated;
grant delete on public.responses to authenticated;

drop policy if exists "Allow anonymous response submissions" on public.responses;
create policy "Allow anonymous response submissions"
    on public.responses
    for insert
    to anon
    with check (true);

drop policy if exists "Allow response admin to read submissions" on public.responses;
create policy "Allow response admin to read submissions"
    on public.responses
    for select
    to authenticated
    using ((auth.jwt() ->> 'email') = 'simulahmed003@gmail.com');

drop policy if exists "Allow response admin to delete submissions" on public.responses;
create policy "Allow response admin to delete submissions"
    on public.responses
    for delete
    to authenticated
    using ((auth.jwt() ->> 'email') = 'simulahmed003@gmail.com');

-- Only the final response is stored, and answers are size-limited.
alter table public.responses
    add constraint responses_question_final check (question = 'Final feedback'),
    add constraint responses_answer_length check (char_length(answer) between 1 and 2100);
