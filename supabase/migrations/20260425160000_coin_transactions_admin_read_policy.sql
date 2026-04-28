-- Allow admin and owner roles to read all coin_transactions for auditing
create policy "coin_transactions: admin read all"
  on public.coin_transactions
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'owner')
    )
  );
