-- Profile photos are public brand-neutral headshots; payroll documents remain private.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-photos', 'profile-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "management upload profile photos" ON storage.objects;
CREATE POLICY "management upload profile photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-photos' AND public.is_admin_or_super());

DROP POLICY IF EXISTS "management update profile photos" ON storage.objects;
CREATE POLICY "management update profile photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND public.is_admin_or_super())
WITH CHECK (bucket_id = 'profile-photos' AND public.is_admin_or_super());

DROP POLICY IF EXISTS "management delete profile photos" ON storage.objects;
CREATE POLICY "management delete profile photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-photos' AND public.is_admin_or_super());
