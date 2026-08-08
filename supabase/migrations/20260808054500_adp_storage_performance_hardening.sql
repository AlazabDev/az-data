-- Cover storage foreign keys used by ownership/audit/infrastructure joins.
CREATE INDEX IF NOT EXISTS storage_locations_endpoint_idx ON public.storage_object_locations(endpoint_id);
CREATE INDEX IF NOT EXISTS storage_objects_origin_project_idx ON public.storage_objects(origin_project_id);
CREATE INDEX IF NOT EXISTS storage_objects_created_by_idx ON public.storage_objects(created_by);
CREATE INDEX IF NOT EXISTS storage_projects_created_by_idx ON public.storage_projects(created_by);
CREATE INDEX IF NOT EXISTS storage_promotions_verified_by_idx ON public.storage_promotions(verified_by);
CREATE INDEX IF NOT EXISTS storage_requests_created_by_idx ON public.storage_requests(created_by);

-- Avoid overlapping permissive SELECT policies: read is independent from writes.
DROP POLICY IF EXISTS storage_requests_write ON public.storage_requests;
DROP POLICY IF EXISTS storage_requests_insert ON public.storage_requests;
DROP POLICY IF EXISTS storage_requests_update ON public.storage_requests;
CREATE POLICY storage_requests_insert ON public.storage_requests
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_storage());
CREATE POLICY storage_requests_update ON public.storage_requests
  FOR UPDATE TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());

DROP POLICY IF EXISTS storage_objects_write ON public.storage_objects;
DROP POLICY IF EXISTS storage_objects_insert ON public.storage_objects;
DROP POLICY IF EXISTS storage_objects_update ON public.storage_objects;
CREATE POLICY storage_objects_insert ON public.storage_objects
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_storage());
CREATE POLICY storage_objects_update ON public.storage_objects
  FOR UPDATE TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());

DROP POLICY IF EXISTS storage_locations_write ON public.storage_object_locations;
DROP POLICY IF EXISTS storage_locations_insert ON public.storage_object_locations;
DROP POLICY IF EXISTS storage_locations_update ON public.storage_object_locations;
DROP POLICY IF EXISTS storage_locations_delete ON public.storage_object_locations;
CREATE POLICY storage_locations_insert ON public.storage_object_locations
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_storage());
CREATE POLICY storage_locations_update ON public.storage_object_locations
  FOR UPDATE TO authenticated USING (public.can_manage_storage()) WITH CHECK (public.can_manage_storage());
CREATE POLICY storage_locations_delete ON public.storage_object_locations
  FOR DELETE TO authenticated USING (public.can_manage_storage());
