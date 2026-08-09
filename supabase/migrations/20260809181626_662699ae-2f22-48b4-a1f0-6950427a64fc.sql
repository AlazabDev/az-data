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