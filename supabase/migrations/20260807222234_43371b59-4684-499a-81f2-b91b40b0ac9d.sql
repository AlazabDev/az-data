-- Add missing columns expected by the ADP UI
ALTER TABLE public.systems
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS business_owner TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner TEXT,
  ADD COLUMN IF NOT EXISTS operational_notes TEXT;

ALTER TABLE public.environments
  ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE public.databases
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS engine_version TEXT,
  ADD COLUMN IF NOT EXISTS restore_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS technical_owner TEXT,
  ADD COLUMN IF NOT EXISTS business_owner TEXT,
  ADD COLUMN IF NOT EXISTS backup_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS technical_owner TEXT;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_label TEXT;

-- Revoke public execute on SECURITY DEFINER helper functions to satisfy linter
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_adp_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_audit() FROM PUBLIC;

-- Keep authenticated execute only where intentionally needed (none of these are client-callable)
-- Service role retains execute by default.
