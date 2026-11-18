-- Exclusões administrativas acontecem pela Edge Function com a service role.
-- Permitir esse contexto preserva os gatilhos de integridade em cascatas como
-- a remoção do vínculo de cônjuge ao excluir um perfil.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    if new.role <> old.role or new.cpf <> old.cpf or (new.first_login <> old.first_login and not (old.first_login = true and new.first_login = false))
       or new.married <> old.married or new.spouse_id is distinct from old.spouse_id
       or new.has_kids <> old.has_kids or new.name <> old.name or new.birthdate is distinct from old.birthdate
       or new.spouse_name <> old.spouse_name then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
