CREATE OR REPLACE FUNCTION public.can_manage_storage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.has_role(auth.uid(), 'data_engineer'::public.app_role)
      OR public.has_role(auth.uid(), 'database_administrator'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.can_manage_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_storage() TO authenticated;
