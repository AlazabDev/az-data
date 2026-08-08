import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { passwordPolicyMessage, validatePlatformPassword } from "@/lib/password-policy";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور | Alazab Data Platform" },
      { name: "description", content: "تعيين كلمة مرور جديدة لحسابك في منصة بيانات العزب." },
      { property: "og:title", content: "إعادة تعيين كلمة المرور | Alazab Data Platform" },
      { property: "og:description", content: "تعيين كلمة مرور جديدة لحسابك في منصة بيانات العزب." },
    ],
  }),
});

function ResetPasswordPage() {
  const { t, lang } = useI18n();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const violations = useMemo(() => validatePlatformPassword(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const current = validatePlatformPassword(password);
    if (current.length) {
      setError(passwordPolicyMessage(current[0]!, lang === "ar" ? "ar" : "en"));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(err.message);
    else setDone(true);
    setBusy(false);
  }

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-16">
      <div className="panel w-full max-w-md p-8">
        <h1 className="text-lg font-semibold">{t("reset_password")}</h1>
        {done ? (
          <>
            <p className="mt-4 text-sm text-success">{t("password_updated")}</p>
            <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">{t("sign_in")}</Link>
          </>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">{t("new_password")}</Label>
              <Input
                id="new_password"
                type="password"
                dir="ltr"
                minLength={15}
                maxLength={20}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">{lang === "ar" ? "15–20 حرفًا · A-Z / a-z / 0-9 / $ # _" : "15–20 chars · A-Z / a-z / 0-9 / $ # _"}</p>
              {password.length && violations.length ? <p className="text-xs text-destructive">{passwordPolicyMessage(violations[0]!, lang === "ar" ? "ar" : "en")}</p> : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy || violations.length > 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("reset_password")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
