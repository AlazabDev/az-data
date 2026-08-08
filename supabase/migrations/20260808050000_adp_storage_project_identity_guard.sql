CREATE OR REPLACE FUNCTION public.set_storage_project_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.canonical_uri := 'https://alazab.com/Projects/' || NEW.project_code;
  ELSIF TG_OP = 'UPDATE' AND NEW.project_code IS DISTINCT FROM OLD.project_code THEN
    RAISE EXCEPTION 'Project code is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_project_identity_guard ON public.storage_projects;
CREATE TRIGGER storage_project_identity_guard
BEFORE INSERT OR UPDATE OF project_code ON public.storage_projects
FOR EACH ROW EXECUTE FUNCTION public.set_storage_project_identity();

CREATE OR REPLACE FUNCTION public.promote_storage_request(
  _request_id uuid,
  _payment_reference text,
  _payment_received_at timestamptz,
  _payment_amount numeric,
  _payment_currency text DEFAULT 'EGP',
  _verification_source text DEFAULT 'manual_verified'
)
RETURNS TABLE(project_id uuid, project_code text, canonical_uri text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.storage_requests%ROWTYPE;
  v_project public.storage_projects%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: platform admin role required'; END IF;
  IF nullif(trim(_payment_reference), '') IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  IF _payment_received_at IS NULL THEN RAISE EXCEPTION 'Payment received timestamp is required'; END IF;
  IF _payment_amount IS NULL OR _payment_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  IF nullif(trim(_verification_source), '') IS NULL THEN RAISE EXCEPTION 'Verification source is required'; END IF;

  SELECT p.* INTO v_project
  FROM public.storage_promotions sp
  JOIN public.storage_projects p ON p.id = sp.project_id
  WHERE sp.request_id = _request_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_project.id, v_project.project_code, v_project.canonical_uri;
    RETURN;
  END IF;

  SELECT * INTO v_request FROM public.storage_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Storage request not found'; END IF;
  IF v_request.status IN ('closed','cancelled') THEN RAISE EXCEPTION 'Request cannot be promoted from status %', v_request.status; END IF;
  IF v_request.status = 'promoted' THEN RAISE EXCEPTION 'Request is marked promoted but promotion record is missing'; END IF;

  INSERT INTO public.storage_projects (name, client_name, origin_request_id, canonical_uri, created_by)
  VALUES (v_request.name, v_request.client_name, v_request.id, '', auth.uid())
  RETURNING * INTO v_project;

  INSERT INTO public.storage_promotions (
    request_id, project_id, payment_reference, payment_received_at,
    payment_amount, payment_currency, verification_source, verified_by
  ) VALUES (
    v_request.id, v_project.id, trim(_payment_reference), _payment_received_at,
    _payment_amount, upper(coalesce(nullif(trim(_payment_currency), ''), 'EGP')),
    trim(_verification_source), auth.uid()
  );

  UPDATE public.storage_objects
  SET current_request_id = NULL, current_project_id = v_project.id, updated_at = now()
  WHERE current_request_id = v_request.id;

  UPDATE public.storage_requests SET status = 'promoted', updated_at = now() WHERE id = v_request.id;

  RETURN QUERY SELECT v_project.id, v_project.project_code, v_project.canonical_uri;
END;
$$;

REVOKE ALL ON FUNCTION public.set_storage_project_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) TO authenticated;
