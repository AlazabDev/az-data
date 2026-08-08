GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE TABLE IF NOT EXISTS public.adp_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adp_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.adp_settings TO authenticated;
GRANT ALL ON public.adp_settings TO service_role;
ALTER TABLE public.adp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adp_settings_read" ON public.adp_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "adp_settings_write" ON public.adp_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER adp_settings_updated_at BEFORE UPDATE ON public.adp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.adp_login_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adp_login_otp_phone_idx ON public.adp_login_otp (phone, created_at DESC);
GRANT ALL ON public.adp_login_otp TO service_role;
ALTER TABLE public.adp_login_otp ENABLE ROW LEVEL SECURITY;

INSERT INTO public.adp_settings (key, value, description) VALUES
  ('platform', '{"name_ar":"منصة بيانات العزب","name_en":"Alazab Data Platform","domain":"data.alazab.com","default_lang":"ar","default_theme":"dark"}'::jsonb, 'Platform identity and defaults'),
  ('auth', '{"google":true,"microsoft":true,"whatsapp":false,"password":true,"allowed_domains":[]}'::jsonb, 'Sign-in methods'),
  ('storage', '{"presign_seconds":900,"max_upload_mb":512,"multi_upload":true}'::jsonb, 'Cloud storage defaults'),
  ('governance', '{"audit_retention_days":365,"require_backup":true,"health_check_hours":24}'::jsonb, 'Governance thresholds')
ON CONFLICT (key) DO NOTHING;