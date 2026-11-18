create or replace function public.submit_payment_receipt(
  p_payment_id uuid,
  p_installment integer,
  p_storage_path text,
  p_file_name text,
  p_mime_type text
) returns void
language plpgsql security definer set search_path = public, storage as $$
declare
  payment_owner uuid;
  installment_total smallint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select traveler_id, total_installments into payment_owner, installment_total
  from public.payments
  where id = p_payment_id
  for update;
  if not found or payment_owner <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_installment < 1 or p_installment > installment_total then
    raise exception 'invalid installment' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-receipts'
      and name = p_storage_path
      and owner_id = auth.uid()::text
  ) then
    raise exception 'receipt file not found' using errcode = '42501';
  end if;

  insert into public.payment_receipts (
    payment_id, installment, storage_path, file_name, mime_type, note, status
  ) values (
    p_payment_id, p_installment, p_storage_path, p_file_name, p_mime_type, '', 'pending'
  ) on conflict (payment_id, installment) do update
    set storage_path = excluded.storage_path,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        note = '',
        status = 'pending',
        uploaded_at = now();
end;
$$;

grant execute on function public.submit_payment_receipt(uuid,integer,text,text,text) to authenticated;

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated using (
  bucket_id = 'payment-receipts' and (
    public.is_admin()
    or owner_id = auth.uid()::text
    or exists (
      select 1
      from public.payment_receipts receipt
      join public.payments payment on payment.id = receipt.payment_id
      where receipt.storage_path = storage.objects.name
        and payment.traveler_id = auth.uid()
    )
  )
);

create policy receipts_traveler_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'payment-receipts' and owner_id = auth.uid()::text
);
