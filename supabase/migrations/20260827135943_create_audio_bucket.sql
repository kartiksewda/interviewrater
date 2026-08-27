/*
# Create audio storage bucket

1. Storage
- Create a public bucket 'audio' for storing recorded interview audio files.
- Set public read access (files are referenced by URL for transcription).
2. Notes
- Audio files are stored as recordings/{sessionId}.{ext}
*/

INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "anon_read_audio" ON storage.objects;
CREATE POLICY "anon_read_audio" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'audio');

-- Allow anon/authenticated upload
DROP POLICY IF EXISTS "anon_insert_audio" ON storage.objects;
CREATE POLICY "anon_insert_audio" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'audio');

-- Allow update/upsert
DROP POLICY IF EXISTS "anon_update_audio" ON storage.objects;
CREATE POLICY "anon_update_audio" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'audio') WITH CHECK (bucket_id = 'audio');
