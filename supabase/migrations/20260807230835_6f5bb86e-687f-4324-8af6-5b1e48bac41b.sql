CREATE TABLE public.storage_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  provider text NOT NULL DEFAULT 'other',
  endpoint_url text NOT NULL,
  region text NOT NULL DEFAULT 'us-east-1',
  path_style boolean NOT NULL DEFAULT true,
  signature_version text NOT NULL DEFAULT 's3v4',
  secret_prefix text NOT NULL,
  default_bucket text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storage_endpoints TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.storage_endpoints TO authenticated;
GRANT ALL ON public.storage_endpoints TO service_role;

ALTER TABLE public.storage_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read storage endpoints"
  ON public.storage_endpoints FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert storage endpoints"
  ON public.storage_endpoints FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update storage endpoints"
  ON public.storage_endpoints FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete storage endpoints"
  ON public.storage_endpoints FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_storage_endpoints_updated_at
  BEFORE UPDATE ON public.storage_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_storage_endpoints_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.storage_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.record_audit();

INSERT INTO public.storage_endpoints (key, label, provider, endpoint_url, region, path_style, signature_version, secret_prefix, notes) VALUES
  ('aws', 'Amazon S3', 'aws', 'https://s3.amazonaws.com', 'us-east-1', false, 's3v4', 'S3_AWS', 'mc alias: aws'),
  ('gcs', 'Google Cloud Storage', 'gcs', 'https://storage.googleapis.com', 'auto', false, 's3v4', 'S3_GCS', 'mc alias: gcs (HMAC interoperability keys)'),
  ('myminio', 'MinIO Alazab', 'minio', 'https://minio.alazab.cloud', 'us-east-1', true, 's3v4', 'S3_MYMINIO', 'mc alias: myminio'),
  ('oci', 'Oracle Object Storage (Jeddah)', 'oci', 'https://axwmiwn72of7.compat.objectstorage.me-jeddah-1.oraclecloud.com', 'me-jeddah-1', true, 's3v4', 'S3_OCI', 'mc alias: oci'),
  ('r2', 'Cloudflare R2', 'r2', 'https://94c410e126423c32c99f5b25f648f7d5.r2.cloudflarestorage.com', 'auto', true, 's3v4', 'S3_R2', 'mc alias: r2'),
  ('supabase', 'Supabase Storage (S3)', 'supabase', 'http://supabase.alazab.com', 'us-east-1', true, 's3v4', 'S3_SUPABASE', 'mc alias: supabase');