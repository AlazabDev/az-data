-- Revoke execute on SECURITY DEFINER helper functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_adp_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_audit() FROM anon, authenticated;

-- Also ensure PUBLIC is revoked (covers unauthenticated access)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_adp_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_audit() FROM PUBLIC;
