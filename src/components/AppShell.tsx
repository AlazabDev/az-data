import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Database as DatabaseIcon,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plug,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { AuthPanel } from "@/components/AuthPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", key: "nav_overview", icon: LayoutDashboard },
  { to: "/systems", key: "nav_systems", icon: Layers },
  { to: "/environments", key: "nav_environments", icon: Activity },
  { to: "/databases", key: "nav_databases", icon: DatabaseIcon },
  { to: "/data-sources", key: "nav_data_sources", icon: Plug },
  { to: "/access", key: "nav_access", icon: ShieldCheck },
  { to: "/audit", key: "nav_audit", icon: ScrollText },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading, signOut, roles } = useAuth();
  const { t, te, lang, setLang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthPanel />;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="text-sm font-semibold text-sidebar-foreground">{t("platform_name")}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">data.alazab.com</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="size-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <p className="px-2 text-[11px] text-muted-foreground">
            {t("your_roles")}: {roles.length ? roles.map((r) => te(r)).join("، ") : te("read_only")}
          </p>
          <p className="truncate px-2 font-mono text-[11px] text-muted-foreground">{user.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            {t("sign_out")}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              >
                {lang === "ar" ? "EN" : "ع"}
              </Button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground hover:bg-muted"
                activeProps={{ className: "bg-muted text-foreground" }}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </header>
        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
