-- Alazab Data Platform - Storage Identity Core
-- Provider-neutral, server-first storage registry.

CREATE SEQUENCE IF NOT EXISTS public.storage_request_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.storage_project_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.storage_object_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.next_storage_request_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'RQ-' || to_char(timezone('Africa/Cairo', now()), 'YYYY-MM') || '-' || lpad(nextval('public.storage_request_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_storage_project_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'PRJ-' || to_char(timezone('Africa/Cairo', now()), 'YYYY-MM') || '-' || lpad(nextval('public.storage_project_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_storage_object_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'OBJ-' || to_char(timezone('Africa/Cairo', now()), 'YYYY-MM') || '-' || lpad(nextval('public.storage_object_seq')::text, 6, '0');
$$;

CREATE TABLE IF NOT EXISTS public.storage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text NOT NULL UNIQUE DEFAULT public.next_storage_request_code(),
  name text NOT NULL,
  client_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','on_hold','promoted','closed','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text NOT NULL UNIQUE DEFAULT public.next_storage_project_code(),
  name text NOT NULL,
  client_name text,
  origin_request_id uuid NOT NULL UNIQUE REFERENCES public.storage_requests(id) ON DELETE RESTRICT,
  canonical_uri text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','archived','cancelled')),
  promoted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_code text NOT NULL UNIQUE DEFAULT public.next_storage_object_code(),
  display_name text NOT NULL,
  original_filename text,
  extension text,
  mime_type text,
  content_class text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[A-Fa-f0-9]{64}$'),
  origin_request_id uuid REFERENCES public.storage_requests(id) ON DELETE RESTRICT,
  origin_project_id uuid REFERENCES public.storage_projects(id) ON DELETE RESTRICT,
  current_request_id uuid REFERENCES public.storage_requests(id) ON DELETE RESTRICT,
  current_project_id uuid REFERENCES public.storage_projects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','archived','deleted')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storage_objects_one_origin CHECK (((origin_request_id IS NOT NULL)::int + (origin_project_id IS NOT NULL)::int) = 1),
  CONSTRAINT storage_objects_one_current_owner CHECK (((current_request_id IS NOT NULL)::int + (current_project_id IS NOT NULL)::int) = 1)
);

CREATE TABLE IF NOT EXISTS public.storage_object_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.storage_objects(id) ON DELETE CASCADE,
  location_kind text NOT NULL DEFAULT 'server' CHECK (location_kind IN ('server','s3','object_storage','file_store','external')),
  endpoint_id uuid REFERENCES public.storage_endpoints(id) ON DELETE SET NULL,
  physical_locator text NOT NULL,
  bucket text,
  object_key text,
  location_role text NOT NULL DEFAULT 'primary' CHECK (location_role IN ('primary','replica','archive','cache','delivery','working')),
  is_primary boolean NOT NULL DEFAULT false,
  availability text NOT NULL DEFAULT 'unknown' CHECK (availability IN ('available','unavailable','unknown')),
  etag text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[A-Fa-f0-9]{64}$'),
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_id, physical_locator)
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_object_locations_one_primary_idx
  ON public.storage_object_locations(object_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS public.storage_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.storage_requests(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL UNIQUE REFERENCES public.storage_projects(id) ON DELETE RESTRICT,
  payment_reference text NOT NULL,
  payment_received_at timestamptz NOT NULL,
  payment_verified_at timestamptz NOT NULL DEFAULT now(),
  payment_amount numeric(18,2) NOT NULL CHECK (payment_amount > 0),
  payment_currency text NOT NULL DEFAULT 'EGP',
  verification_source text NOT NULL,
  verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verification_source, payment_reference)
);

CREATE INDEX IF NOT EXISTS storage_objects_origin_request_idx ON public.storage_objects(origin_request_id);
CREATE INDEX IF NOT EXISTS storage_objects_current_request_idx ON public.storage_objects(current_request_id);
CREATE INDEX IF NOT EXISTS storage_objects_current_project_idx ON public.storage_objects(current_project_id);
CREATE INDEX IF NOT EXISTS storage_locations_object_idx ON public.storage_object_locations(object_id);
CREATE INDEX IF NOT EXISTS storage_locations_availability_idx ON public.storage_object_locations(availability, location_kind);

DROP TRIGGER IF EXISTS storage_requests_updated_at ON public.storage_requests;
CREATE TRIGGER storage_requests_updated_at BEFORE UPDATE ON public.storage_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS storage_projects_updated_at ON public.storage_projects;
CREATE TRIGGER storage_projects_updated_at BEFORE UPDATE ON public.storage_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS storage_objects_updated_at ON public.storage_objects;
CREATE TRIGGER storage_objects_updated_at BEFORE UPDATE ON public.storage_objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS storage_object_locations_updated_at ON public.storage_object_locations;
CREATE TRIGGER storage_object_locations_updated_at BEFORE UPDATE ON public.storage_object_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS audit_storage_requests_trigger ON public.storage_requests;
CREATE TRIGGER audit_storage_requests_trigger AFTER INSERT OR UPDATE OR DELETE ON public.storage_requests FOR EACH ROW EXECUTE FUNCTION public.record_audit();
DROP TRIGGER IF EXISTS audit_storage_projects_trigger ON public.storage_projects;
CREATE TRIGGER audit_storage_projects_trigger AFTER INSERT OR UPDATE OR DELETE ON public.storage_projects FOR EACH ROW EXECUTE FUNCTION public.record_audit();
DROP TRIGGER IF EXISTS audit_storage_objects_trigger ON public.storage_objects;
CREATE TRIGGER audit_storage_objects_trigger AFTER INSERT OR UPDATE OR DELETE ON public.storage_objects FOR EACH ROW EXECUTE FUNCTION public.record_audit();
DROP TRIGGER IF EXISTS audit_storage_object_locations_trigger ON public.storage_object_locations;
CREATE TRIGGER audit_storage_object_locations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.storage_object_locations FOR EACH ROW EXECUTE FUNCTION public.record_audit();
DROP TRIGGER IF EXISTS audit_storage_promotions_trigger ON public.storage_promotions;
CREATE TRIGGER audit_storage_promotions_trigger AFTER INSERT OR UPDATE OR DELETE ON public.storage_promotions FOR EACH ROW EXECUTE FUNCTION public.record_audit();

CREATE OR REPLACE FUNCTION public.can_manage_storage()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.can_manage_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_storage() TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.storage_requests TO authenticated;
GRANT SELECT ON public.storage_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.storage_objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_object_locations TO authenticated;
GRANT SELECT ON public.storage_promotions TO authenticated;
GRANT ALL ON public.storage_requests, public.storage_projects, public.storage_objects, public.storage_object_locations, public.storage_promotions TO service_role;

ALTER TABLE public.storage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_object_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_requests_read ON public.storage_requests;
CREATE POLICY storage_requests_read ON public.storage_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS storage_requests_write ON public.storage_requests;
CREATE POLICY storage_requests_write ON public.storage_requests FOR ALL TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());
DROP POLICY IF EXISTS storage_projects_read ON public.storage_projects;
CREATE POLICY storage_projects_read ON public.storage_projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS storage_objects_read ON public.storage_objects;
CREATE POLICY storage_objects_read ON public.storage_objects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS storage_objects_write ON public.storage_objects;
CREATE POLICY storage_objects_write ON public.storage_objects FOR ALL TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());
DROP POLICY IF EXISTS storage_locations_read ON public.storage_object_locations;
CREATE POLICY storage_locations_read ON public.storage_object_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS storage_locations_write ON public.storage_object_locations;
CREATE POLICY storage_locations_write ON public.storage_object_locations FOR ALL TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());
DROP POLICY IF EXISTS storage_promotions_read ON public.storage_promotions;
CREATE POLICY storage_promotions_read ON public.storage_promotions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.promote_storage_request(
  _request_id uuid,
  _payment_reference text,
  _payment_received_at timestamptz,
  _payment_amount numeric,
  _payment_currency text DEFAULT 'EGP',
  _verification_source text DEFAULT 'manual_verified'
)
RETURNS TABLE(project_id uuid, project_code text, canonical_uri text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT p.* INTO v_project
  FROM public.storage_promotions sp JOIN public.storage_projects p ON p.id = sp.project_id
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
  VALUES (v_request.name, v_request.client_name, v_request.id, 'pending', auth.uid())
  RETURNING * INTO v_project;

  UPDATE public.storage_projects
  SET canonical_uri = 'https://alazab.com/Projects/' || v_project.project_code
  WHERE id = v_project.id
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
REVOKE ALL ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_storage_request(uuid,text,timestamptz,numeric,text,text) TO authenticated;

CREATE OR REPLACE VIEW public.storage_object_resolution AS
SELECT DISTINCT ON (o.id)
  o.id AS object_id,
  o.object_code,
  l.id AS location_id,
  l.location_kind,
  l.endpoint_id,
  l.physical_locator,
  l.bucket,
  l.object_key,
  l.location_role,
  l.is_primary,
  l.availability,
  l.last_verified_at
FROM public.storage_objects o
LEFT JOIN public.storage_object_locations l ON l.object_id = o.id
ORDER BY o.id,
  CASE WHEN l.availability = 'available' THEN 0 WHEN l.availability = 'unknown' THEN 1 ELSE 2 END,
  CASE WHEN l.location_kind = 'server' THEN 0 ELSE 1 END,
  CASE WHEN l.is_primary THEN 0 ELSE 1 END,
  l.last_verified_at DESC NULLS LAST;

GRANT SELECT ON public.storage_object_resolution TO authenticated, service_role;
