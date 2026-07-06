-- Copie de référence des migrations appliquées au projet Supabase
-- (pktzbwhsugtcdduxjgfu) via MCP.
-- 3/3 : gamification du profil joueur
--   - 2026-07-05 add_player_preferences_to_profiles (bio, côté préféré, raquette)
--   - 2026-07-06 profile_avatar_and_storage (avatar_url + bucket "avatars")

-- Champs éditoriaux du profil (déjà appliqués le 2026-07-05)
alter table public.profiles
  add column if not exists bio text check (char_length(bio) <= 280),
  add column if not exists preferred_side text check (preferred_side in ('left', 'right', 'both')),
  add column if not exists racket text check (char_length(racket) <= 60);

-- Photo de profil : URL publique du fichier dans le bucket "avatars"
alter table public.profiles
  add column if not exists avatar_url text check (char_length(avatar_url) <= 300);

-- Bucket public pour les avatars (lecture ouverte, la sécurité d'écriture
-- repose sur le préfixe de chemin = uid du propriétaire)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
