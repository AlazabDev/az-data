import { useState, type FormEvent } from "react";
import { Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthPanel() {
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  function friendly(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials")) return t("err_invalid_credentials");
    if (m.includes("email not confirmed")) return t("err_email_not_confirmed");
    if (m.includes("already registered") || m.includes("user already")) return t("err_user_exists");
    if (m.includes("rate limit") || m.includes("too many")) return t("err_rate_limit");
    return raw;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setNeedsConfirm(false);
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(friendly(err.message));
        if (err.message.toLowerCase().includes("email not confirmed")) setNeedsConfirm(true);
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      if (err) setError(friendly(err.message));
      else if (!data.session) setMessage(t("check_email"));
    }
    setBusy(false);
  }

  async function onForgot() {
    if (!email.trim()) {
      setError(t("err_email_required"));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(friendly(err.message));
    else setMessage(t("reset_link_sent"));
    setBusy(false);
  }

  async function onResend() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(friendly(err.message));
    else setMessage(t("confirmation_sent"));
    setBusy(false);
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(String(result.error));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }


  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-16">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Database className="size-5" />
          </span>
          <div>
            <h1 className="text-lg leading-tight font-semibold">{t("platform_name")}</h1>
            <p className="font-mono text-xs text-muted-foreground">data@alazab.com</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">{t("auth_intro")}</p>

        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          disabled={busy}
          onClick={() => void onGoogle()}
        >
          {t("continue_google")}
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>—</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t("full_name")}</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-success">{message}</p> : null}
          {needsConfirm ? (
            <button
              type="button"
              className="text-xs text-primary underline-offset-4 hover:underline"
              onClick={() => void onResend()}
              disabled={busy}
            >
              {t("resend_confirmation")}
            </button>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? t("sign_in") : t("sign_up")}
          </Button>

          {mode === "signin" ? (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => void onForgot()}
              disabled={busy}
            >
              {t("forgot_password")}
            </button>
          ) : null}
        </form>


        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setMessage(null);
          }}
        >
          {mode === "signin" ? t("sign_up") : t("sign_in")}
        </button>
      </div>
    </div>
  );
}
