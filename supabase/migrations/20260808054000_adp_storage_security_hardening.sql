-- Storage resolution must honor the querying user's RLS context.
ALTER VIEW public.storage_object_resolution SET (security_invoker = true);

-- Role predicates do not need elevated privileges because authenticated users
-- can read only their own adp_user_roles rows through RLS.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.adp_user_roles
       WHERE user_id = _user_id AND role = _role
     );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.adp_user_roles
    WHERE user_id = auth.uid()
      AND role IN ('platform_owner','platform_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_storage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.adp_user_roles
    WHERE user_id = auth.uid()
      AND role IN ('platform_owner','platform_admin','data_engineer','database_administrator')
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_storage() TO authenticated;
