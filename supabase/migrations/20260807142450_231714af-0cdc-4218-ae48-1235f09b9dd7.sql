-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('platform_owner','platform_admin','database_administrator','data_engineer','application_owner','integration_manager','analyst','read_only');
CREATE TYPE public.lifecycle_status AS ENUM ('active','inactive','maintenance','deprecated','archived','unknown');
CREATE TYPE public.health_status AS ENUM ('healthy','warning','critical','unknown');
CREATE TYPE public.criticality_level AS ENUM ('critical','high','medium','low','unknown');
CREATE TYPE public.environment_kind AS ENUM ('production','staging','development','testing','sandbox','dr','other');
CREATE TYPE public.datasource_kind AS ENUM ('api','file_store','object_storage','queue','cache','warehouse','vector_store','spreadsheet','other');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_write_registry(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('platform_owner','platform_admin','database_administrator','data_engineer')
  )
$$;

CREATE POLICY "roles_read" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_owner') OR public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(),'platform_owner') OR public.has_role(auth.uid(),'platform_admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  SELECT count(*) INTO existing_count FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_count = 0 THEN 'platform_owner'::public.app_role ELSE 'read_only'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_label TEXT,
  before_data JSONB,
  after_data JSONB,
  result TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label TEXT; v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_label := COALESCE(to_jsonb(OLD)->>'name', to_jsonb(OLD)->>'code');
    INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data)
    VALUES (auth.uid(), v_email, 'delete', TG_TABLE_NAME, OLD.id, v_label, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  v_label := COALESCE(to_jsonb(NEW)->>'name', to_jsonb(NEW)->>'code');
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  VALUES (auth.uid(), v_email, lower(TG_OP), TG_TABLE_NAME, NEW.id, v_label,
          CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
  RETURN NEW;
END;
$$;

-- ============ SYSTEMS ============
CREATE TABLE public.systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT,
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  criticality public.criticality_level NOT NULL DEFAULT 'unknown',
  business_owner TEXT,
  technical_owner TEXT,
  operational_notes TEXT,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.systems TO authenticated;
GRANT ALL ON public.systems TO service_role;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "systems_read" ON public.systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "systems_write" ON public.systems FOR ALL TO authenticated
  USING (public.can_write_registry(auth.uid())) WITH CHECK (public.can_write_registry(auth.uid()));
CREATE TRIGGER systems_updated BEFORE UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER systems_audit AFTER INSERT OR UPDATE OR DELETE ON public.systems FOR EACH ROW EXECUTE FUNCTION public.record_audit();

-- ============ ENVIRONMENTS ============
CREATE TABLE public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  kind public.environment_kind NOT NULL DEFAULT 'other',
  name TEXT NOT NULL,
  description TEXT,
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (system_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environments TO authenticated;
GRANT ALL ON public.environments TO service_role;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "environments_read" ON public.environments FOR SELECT TO authenticated USING (true);
CREATE POLICY "environments_write" ON public.environments FOR ALL TO authenticated
  USING (public.can_write_registry(auth.uid())) WITH CHECK (public.can_write_registry(auth.uid()));
CREATE TRIGGER environments_updated BEFORE UPDATE ON public.environments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER environments_audit AFTER INSERT OR UPDATE OR DELETE ON public.environments FOR EACH ROW EXECUTE FUNCTION public.record_audit();

-- ============ DATABASES ============
CREATE TABLE public.databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  engine TEXT,
  engine_version TEXT,
  target_version TEXT,
  provider TEXT,
  region TEXT,
  host TEXT,
  port INTEGER,
  database_name TEXT,
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  health public.health_status NOT NULL DEFAULT 'unknown',
  health_reason TEXT,
  criticality public.criticality_level NOT NULL DEFAULT 'unknown',
  business_owner TEXT,
  technical_owner TEXT,
  operations_owner TEXT,
  backup_policy TEXT,
  backup_required BOOLEAN NOT NULL DEFAULT true,
  last_backup_at TIMESTAMPTZ,
  last_restore_test_at TIMESTAMPTZ,
  restore_verified BOOLEAN NOT NULL DEFAULT false,
  monitoring_policy TEXT,
  last_health_check_at TIMESTAMPTZ,
  schema_version TEXT,
  migration_version TEXT,
  connection_reference TEXT,
  dependencies TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.databases TO authenticated;
GRANT ALL ON public.databases TO service_role;
ALTER TABLE public.databases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "databases_read" ON public.databases FOR SELECT TO authenticated USING (true);
CREATE POLICY "databases_write" ON public.databases FOR ALL TO authenticated
  USING (public.can_write_registry(auth.uid())) WITH CHECK (public.can_write_registry(auth.uid()));
CREATE TRIGGER databases_updated BEFORE UPDATE ON public.databases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER databases_audit AFTER INSERT OR UPDATE OR DELETE ON public.databases FOR EACH ROW EXECUTE FUNCTION public.record_audit();

-- ============ DATA SOURCES ============
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind public.datasource_kind NOT NULL DEFAULT 'other',
  location TEXT,
  data_format TEXT,
  provider TEXT,
  status public.lifecycle_status NOT NULL DEFAULT 'unknown',
  health public.health_status NOT NULL DEFAULT 'unknown',
  criticality public.criticality_level NOT NULL DEFAULT 'unknown',
  business_owner TEXT,
  technical_owner TEXT,
  connection_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources TO authenticated;
GRANT ALL ON public.data_sources TO service_role;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_sources_read" ON public.data_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "data_sources_write" ON public.data_sources FOR ALL TO authenticated
  USING (public.can_write_registry(auth.uid())) WITH CHECK (public.can_write_registry(auth.uid()));
CREATE TRIGGER data_sources_updated BEFORE UPDATE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER data_sources_audit AFTER INSERT OR UPDATE OR DELETE ON public.data_sources FOR EACH ROW EXECUTE FUNCTION public.record_audit();

-- ============ SEED: known systems, all Unknown until discovery ============
INSERT INTO public.systems (code, name, description, purpose, status, criticality) VALUES
  ('uberfix','UberFix','Field service and maintenance operations system.','Service operations','unknown','unknown'),
  ('azbim','AzBIM','Building information modeling platform.','Engineering / BIM','unknown','unknown'),
  ('erpnext','ERPNext','Enterprise resource planning system.','Finance and operations','unknown','unknown'),
  ('products','Products','Product catalog and product data system.','Product data','unknown','unknown'),
  ('auth','Auth','Central authentication and identity system.','Identity','unknown','unknown'),
  ('store','Store','Commerce / storefront system.','Sales','unknown','unknown'),
  ('ai_systems','AI Systems','AI agents, assistants and inference services.','AI','unknown','unknown'),
  ('content_processing','Content Processing','Content ingestion, transformation and processing services.','Content','unknown','unknown');
