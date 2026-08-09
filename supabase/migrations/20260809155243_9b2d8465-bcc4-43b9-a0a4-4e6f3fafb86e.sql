CREATE TABLE public.adp_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('auth','storage')),
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure')),
  actor_id uuid,
  actor_email text,
  description text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX adp_security_events_created_at_idx ON public.adp_security_events (created_at DESC);
CREATE INDEX adp_security_events_category_idx ON public.adp_security_events (category, created_at DESC);

GRANT SELECT ON public.adp_security_events TO authenticated;
GRANT ALL ON public.adp_security_events TO service_role;

ALTER TABLE public.adp_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read security events"
ON public.adp_security_events
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_security_event(
  _category text,
  _event_type text,
  _status text DEFAULT 'success',
  _actor_email text DEFAULT NULL,
  _description text DEFAULT NULL,
  _detail jsonb DEFAULT '{}'::jsonb,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _category NOT IN ('auth','storage') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;
  IF coalesce(_status,'success') NOT IN ('success','failure') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO public.adp_security_events (
    category, event_type, status, actor_id, actor_email, description, detail, ip_address, user_agent
  ) VALUES (
    _category,
    left(coalesce(nullif(trim(_event_type), ''), 'unknown'), 80),
    coalesce(_status, 'success'),
    auth.uid(),
    left(nullif(trim(coalesce(_actor_email, '')), ''), 320),
    left(nullif(trim(coalesce(_description, '')), ''), 500),
    coalesce(_detail, '{}'::jsonb),
    left(nullif(trim(coalesce(_ip_address, '')), ''), 100),
    left(nullif(trim(coalesce(_user_agent, '')), ''), 400)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb, text, text) TO anon, authenticated, service_role;