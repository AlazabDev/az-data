-- Alazab Data Platform - immutable storage identity + direct server ingestion.

CREATE OR REPLACE FUNCTION public.set_storage_project_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.canonical_uri := 'https://alazab.com/Projects/' || NEW.project_code;
  ELSE
    IF NEW.project_code IS DISTINCT FROM OLD.project_code THEN
      RAISE EXCEPTION 'Project code is immutable';
    END IF;
    NEW.canonical_uri := 'https://alazab.com/Projects/' || OLD.project_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_project_identity_guard ON public.storage_projects;
CREATE TRIGGER storage_project_identity_guard
BEFORE INSERT OR UPDATE ON public.storage_projects
FOR EACH ROW EXECUTE FUNCTION public.set_storage_project_identity();

CREATE OR REPLACE FUNCTION public.guard_storage_identity_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF to_jsonb(NEW)->>TG_ARGV[0] IS DISTINCT FROM to_jsonb(OLD)->>TG_ARGV[0] THEN
    RAISE EXCEPTION '% is immutable', TG_ARGV[0];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storage_request_identity_guard ON public.storage_requests;
CREATE TRIGGER storage_request_identity_guard
BEFORE UPDATE OF request_code ON public.storage_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_storage_identity_column('request_code');

DROP TRIGGER IF EXISTS storage_object_identity_guard ON public.storage_objects;
CREATE TRIGGER storage_object_identity_guard
BEFORE UPDATE OF object_code ON public.storage_objects
FOR EACH ROW EXECUTE FUNCTION public.guard_storage_identity_column('object_code');

CREATE OR REPLACE FUNCTION public.reserve_storage_object_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_storage() THEN
    RAISE EXCEPTION 'Forbidden: storage manager role required';
  END IF;
  RETURN public.next_storage_object_code();
END;
$$;

CREATE OR REPLACE FUNCTION public.register_storage_server_object(
  _object_code text,
  _context_type text,
  _context_id uuid,
  _display_name text,
  _original_filename text,
  _extension text,
  _mime_type text,
  _content_class text,
  _size_bytes bigint,
  _sha256 text
)
RETURNS TABLE(object_id uuid, object_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_object public.storage_objects%ROWTYPE;
  v_request public.storage_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_storage() THEN
    RAISE EXCEPTION 'Forbidden: storage manager role required';
  END IF;
  IF _object_code !~ '^OBJ-[0-9]{4}-[0-9]{2}-[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid reserved object code';
  END IF;
  IF nullif(trim(_display_name), '') IS NULL THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;
  IF _size_bytes IS NULL OR _size_bytes < 0 THEN
    RAISE EXCEPTION 'Invalid object size';
  END IF;
  IF _sha256 IS NULL OR _sha256 !~ '^[A-Fa-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid SHA-256';
  END IF;

  IF lower(_context_type) = 'request' THEN
    SELECT * INTO v_request FROM public.storage_requests WHERE id = _context_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Storage request not found'; END IF;
    IF v_request.status IN ('promoted','closed','cancelled') THEN
      RAISE EXCEPTION 'Request does not accept new objects in status %', v_request.status;
    END IF;

    INSERT INTO public.storage_objects (
      object_code, display_name, original_filename, extension, mime_type, content_class,
      size_bytes, sha256, origin_request_id, current_request_id, created_by
    ) VALUES (
      _object_code, trim(_display_name), nullif(trim(_original_filename), ''), nullif(trim(_extension), ''),
      nullif(trim(_mime_type), ''), nullif(trim(_content_class), ''), _size_bytes, lower(_sha256),
      _context_id, _context_id, auth.uid()
    ) RETURNING * INTO v_object;
  ELSIF lower(_context_type) = 'project' THEN
    IF NOT EXISTS (SELECT 1 FROM public.storage_projects WHERE id = _context_id) THEN
      RAISE EXCEPTION 'Storage project not found';
    END IF;

    INSERT INTO public.storage_objects (
      object_code, display_name, original_filename, extension, mime_type, content_class,
      size_bytes, sha256, origin_project_id, current_project_id, created_by
    ) VALUES (
      _object_code, trim(_display_name), nullif(trim(_original_filename), ''), nullif(trim(_extension), ''),
      nullif(trim(_mime_type), ''), nullif(trim(_content_class), ''), _size_bytes, lower(_sha256),
      _context_id, _context_id, auth.uid()
    ) RETURNING * INTO v_object;
  ELSE
    RAISE EXCEPTION 'context_type must be request or project';
  END IF;

  INSERT INTO public.storage_object_locations (
    object_id, location_kind, physical_locator, location_role, is_primary,
    availability, size_bytes, sha256, last_verified_at
  ) VALUES (
    v_object.id, 'server', 'server://primary/' || v_object.object_code, 'primary', true,
    'available', _size_bytes, lower(_sha256), now()
  );

  RETURN QUERY SELECT v_object.id, v_object.object_code;
END;
$$;

-- Lock the Request before checking for an existing promotion so concurrent
-- calls converge on the same PRJ instead of racing each other.
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
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: platform admin role required';
  END IF;
  IF nullif(trim(_payment_reference), '') IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  IF _payment_received_at IS NULL THEN RAISE EXCEPTION 'Payment received timestamp is required'; END IF;
  IF _payment_amount IS NULL OR _payment_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  IF nullif(trim(_verification_source), '') IS NULL THEN RAISE EXCEPTION 'Verification source is required'; END IF;

  SELECT * INTO v_request
  FROM public.storage_requests
  WHERE id = _request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Storage request not found'; END IF;

  SELECT p.* INTO v_project
  FROM public.storage_promotions sp
  JOIN public.storage_projects p ON p.id = sp.project_id
  WHERE sp.request_id = _request_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_project.id, v_project.project_code, v_project.canonical_uri;
    RETURN;
  END IF;

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

REVOKE ALL ON FUNCTION public.guard_storage_identity_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_storage_object_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_storage_server_object(text,text,uuid,text,text,text,text,text,bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_storage_object_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_storage_server_object(text,text,uuid,text,text,text,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) TO authenticated;
