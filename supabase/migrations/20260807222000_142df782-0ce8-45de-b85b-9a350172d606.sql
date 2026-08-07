-- Alazab Data Platform foundation schema
-- Uses adp_ prefix for user/profile tables to avoid conflicts with existing project tables.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'platform_owner', 'platform_admin', 'database_administrator',
      'data_engineer', 'data_analyst', 'read_only'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lifecycle_status') THEN
    CREATE TYPE public.lifecycle_status AS ENUM (
      'active', 'inactive', 'maintenance', 'deprecated', 'archived', 'unknown'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_status') THEN
    CREATE TYPE public.health_status AS ENUM (
      'healthy', 'warning', 'critical', 'unknown'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'criticality_level') THEN
    CREATE TYPE public.criticality_level AS ENUM (
      'critical', 'high', 'medium', 'low', 'unknown'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environment_kind') THEN
    CREATE TYPE public.environment_kind AS ENUM (
      'production', 'staging', 'development', 'testing', 'sandbox', 'dr', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'datasource_kind') THEN
    CREATE TYPE public.datasource_kind AS ENUM (
      'api', 'file_store', 'object_storage', 'queue', 'cache',
      'warehouse', 'vector_store', 'spreadsheet', 'other'
    );
  END IF;
END;
$$;

-- ADP Profiles table (isolated from existing public.profiles)
CREATE TABLE IF NOT EXISTS public.adp_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adp_profiles TO authenticated;
GRANT ALL ON public.adp_profiles TO service_role;
ALTER TABLE public.adp_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own adp profile" ON public.adp_profiles;
CREATE POLICY "Users can read own adp profile"
  ON public.adp_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own adp profile" ON public.adp_profiles;
CREATE POLICY "Users can update own adp profile"
  ON public.adp_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can manage adp profiles" ON public.adp_profiles;
CREATE POLICY "Service role can manage adp profiles"
  ON public.adp_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ADP User roles table (isolated from existing public.user_roles)
CREATE TABLE IF NOT EXISTS public.adp_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.adp_user_roles TO authenticated;
GRANT ALL ON public.adp_user_roles TO service_role;
ALTER TABLE public.adp_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own adp roles" ON public.adp_user_roles;
CREATE POLICY "Users can read own adp roles"
  ON public.adp_user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage adp roles" ON public.adp_user_roles;
CREATE POLICY "Service role can manage adp roles"
  ON public.adp_user_roles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.adp_user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.adp_user_roles
    WHERE user_id = auth.uid() AND role IN ('platform_owner', 'platform_admin')
  );
$$;

-- Systems registry
CREATE TABLE IF NOT EXISTS public.systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  health public.health_status NOT NULL DEFAULT 'unknown',
  criticality public.criticality_level NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.systems TO authenticated;
GRANT ALL ON public.systems TO service_role;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read systems" ON public.systems;
CREATE POLICY "Authenticated users can read systems"
  ON public.systems FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Write roles can manage systems" ON public.systems;
CREATE POLICY "Write roles can manage systems"
  ON public.systems FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'));

-- Environments registry
CREATE TABLE IF NOT EXISTS public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind public.environment_kind NOT NULL DEFAULT 'other',
  region TEXT,
  url TEXT,
  health public.health_status NOT NULL DEFAULT 'unknown',
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.environments TO authenticated;
GRANT ALL ON public.environments TO service_role;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read environments" ON public.environments;
CREATE POLICY "Authenticated users can read environments"
  ON public.environments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Write roles can manage environments" ON public.environments;
CREATE POLICY "Write roles can manage environments"
  ON public.environments FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'));

-- Databases registry
CREATE TABLE IF NOT EXISTS public.databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'Other',
  version TEXT,
  target_version TEXT,
  host TEXT,
  port INTEGER,
  backup_enabled BOOLEAN NOT NULL DEFAULT false,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  health public.health_status NOT NULL DEFAULT 'unknown',
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT ALL ON public.databases TO service_role;
ALTER TABLE public.databases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read databases" ON public.databases;
CREATE POLICY "Authenticated users can read databases"
  ON public.databases FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Write roles can manage databases" ON public.databases;
CREATE POLICY "Write roles can manage databases"
  ON public.databases FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'));

-- Data sources registry
CREATE TABLE IF NOT EXISTS public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind public.datasource_kind NOT NULL DEFAULT 'other',
  endpoint TEXT,
  region TEXT,
  health public.health_status NOT NULL DEFAULT 'unknown',
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources TO authenticated;
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read data sources" ON public.data_sources;
CREATE POLICY "Authenticated users can read data sources"
  ON public.data_sources FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Write roles can manage data sources" ON public.data_sources;
CREATE POLICY "Write roles can manage data sources"
  ON public.data_sources FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'data_engineer'));

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  actor_id UUID,
  actor_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit logs"
  ON public.audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.record_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_uuid UUID := auth.uid();
  actor_email_text TEXT := NULL;
BEGIN
  IF actor_uuid IS NOT NULL THEN
    SELECT email INTO actor_email_text FROM auth.users WHERE id = actor_uuid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, actor_id, actor_email)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), actor_uuid, actor_email_text);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, actor_id, actor_email)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), actor_uuid, actor_email_text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, actor_id, actor_email)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), actor_uuid, actor_email_text);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach audit triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_systems_trigger') THEN
    CREATE TRIGGER audit_systems_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.systems
    FOR EACH ROW EXECUTE FUNCTION public.record_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_environments_trigger') THEN
    CREATE TRIGGER audit_environments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.environments
    FOR EACH ROW EXECUTE FUNCTION public.record_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_databases_trigger') THEN
    CREATE TRIGGER audit_databases_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.databases
    FOR EACH ROW EXECUTE FUNCTION public.record_audit();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_data_sources_trigger') THEN
    CREATE TRIGGER audit_data_sources_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.data_sources
    FOR EACH ROW EXECUTE FUNCTION public.record_audit();
  END IF;
END;
$$;

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Attach updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_systems_updated_at') THEN
    CREATE TRIGGER update_systems_updated_at BEFORE UPDATE ON public.systems
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_environments_updated_at') THEN
    CREATE TRIGGER update_environments_updated_at BEFORE UPDATE ON public.environments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_databases_updated_at') THEN
    CREATE TRIGGER update_databases_updated_at BEFORE UPDATE ON public.databases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_data_sources_updated_at') THEN
    CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- Bootstrap first ADP user as platform_owner
CREATE OR REPLACE FUNCTION public.bootstrap_first_adp_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.adp_user_roles WHERE role = 'platform_owner') THEN
    INSERT INTO public.adp_user_roles (user_id, role) VALUES (NEW.id, 'platform_owner');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'bootstrap_first_adp_user_trigger') THEN
    CREATE TRIGGER bootstrap_first_adp_user_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_adp_user();
  END IF;
END;
$$;

-- Seed known Alazab systems
INSERT INTO public.systems (name, description, owner, status, health, criticality)
VALUES
  ('UberFix', 'تطبيق إدارة الطلبات والصيانة', 'Operations', 'active', 'healthy', 'critical'),
  ('AzBIM', 'منصة إدارة مشاريع البناء والنمذجة', 'Engineering', 'active', 'healthy', 'high'),
  ('ERPNext', 'نظام تخطيط الموارد المؤسسية', 'Finance', 'active', 'warning', 'critical'),
  ('Seafile', 'مستودع الملفات والمستندات', 'IT', 'active', 'healthy', 'medium'),
  ('WhatsApp Bot', 'روبوت التواصل عبر واتساب', 'Customer Success', 'active', 'healthy', 'high'),
  ('Foundry AI', 'منصة الذكاء الاصطناعي والتحليلات', 'Data Team', 'active', 'warning', 'high')
ON CONFLICT DO NOTHING;

-- Enable realtime for registry tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.systems;
ALTER PUBLICATION supabase_realtime ADD TABLE public.environments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.databases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.data_sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
