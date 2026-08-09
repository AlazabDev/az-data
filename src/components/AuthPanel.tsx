import { useMemo, useState, type FormEvent } from "react";
import { Database, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { requestWhatsappOtp, verifyWhatsappOtp } from "@/lib/whatsapp-auth.functions";
import { passwordPolicyMessage, validatePlatformPassword } from "@/lib/password-policy";
import { logSecurityEvent } from "@/lib/security-log";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthPanel() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const passwordErrors = useMemo(() => (mode === "signup" ? validatePlatformPassword(password) : []), [mode, password]);

  function friendly(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials")) return t("err_invalid_credentials");
    if (m.includes("email not confirmed")) return t("err_email_not_confirmed");
    if (m.includes("already registered") || m.includes("user already")) return t("err_user_exists");
    if (m.includes("rate limit") || m.includes("too many")) return t("err_rate_limit");
    return raw;
  }

  function reset() {
    setError(null);
    setMessage(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    reset();
    setNeedsConfirm(false);

    if (mode === "signup") {
      const violations = validatePlatformPassword(password);
      if (violations.length) {
        setError(passwordPolicyMessage(violations[0]!, lang === "ar" ? "ar" : "en"));
        return;
      }
    }

    setBusy(true);
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (err) {
        setError(friendly(err.message));
        if (err.message.toLowerCase().includes("email not confirmed")) setNeedsConfirm(true);
        void logSecurityEvent({
          category: "auth",
          eventType: "sign_in_password",
          status: "failure",
          actorEmail: email.trim().toLowerCase(),
          description: err.message,
        });
      } else {
        void logSecurityEvent({
          category: "auth",
          eventType: "sign_in_password",
          actorEmail: email.trim().toLowerCase(),
        });
      }
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
      });
      if (err) setError(friendly(err.message));
      else if (!data.session) setMessage(t("check_email"));
      void logSecurityEvent({
        category: "auth",
        eventType: "sign_up",
        status: err ? "failure" : "success",
        actorEmail: email.trim().toLowerCase(),
        ...(err ? { description: err.message } : {}),
      });
    }
    setBusy(false);
  }

  async function onForgot() {
    if (!email.trim()) {
      setError(t("err_email_required"));
      return;
    }
    setBusy(true);
    reset();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(friendly(err.message));
    else setMessage(t("reset_link_sent"));
    void logSecurityEvent({
      category: "auth",
      eventType: "password_reset_request",
      status: err ? "failure" : "success",
      actorEmail: email.trim().toLowerCase(),
      ...(err ? { description: err.message } : {}),
    });
    setBusy(false);
  }

  async function onResend() {
    setBusy(true);
    reset();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (err) setError(friendly(err.message));
    else setMessage(t("confirmation_sent"));
    void logSecurityEvent({
      category: "auth",
      eventType: "resend_confirmation",
      status: err ? "failure" : "success",
      actorEmail: email.trim().toLowerCase(),
      ...(err ? { description: err.message } : {}),
    });
    setBusy(false);
  }

  async function onGoogle() {
    setBusy(true);
    reset();
    void logSecurityEvent({ category: "auth", eventType: "oauth_start", detail: { provider: "google" } });
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setError(String(result.error));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  async function onMicrosoft() {
    setBusy(true);
    reset();
    void logSecurityEvent({ category: "auth", eventType: "oauth_start", detail: { provider: "azure" } });
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: window.location.origin, scopes: "email openid profile offline_access" },
    });
    if (err) {
      setError(friendly(err.message));
      setBusy(false);
    }
  }

  async function onSendOtp() {
    setBusy(true);
    reset();
    try {
      await requestWhatsappOtp({ data: { phone: phone.trim() } });
      setOtpSent(true);
      setMessage(t("otp_sent"));
      void logSecurityEvent({ category: "auth", eventType: "whatsapp_otp_request", detail: { phone: phone.trim() } });
    } catch (e) {
      setError((e as Error).message);
      void logSecurityEvent({
        category: "auth",
        eventType: "whatsapp_otp_request",
        status: "failure",
        description: (e as Error).message,
        detail: { phone: phone.trim() },
      });
    }
    setBusy(false);
  }

  async function onVerifyOtp() {
    setBusy(true);
    reset();
    try {
      const { tokenHash } = await verifyWhatsappOtp({ data: { phone: phone.trim(), code: otp.trim() } });
      if (!tokenHash) throw new Error(t("err_otp_session"));
      const { error: err } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
      if (err) setError(friendly(err.message));
      void logSecurityEvent({
        category: "auth",
        eventType: "whatsapp_otp_verify",
        status: err ? "failure" : "success",
        detail: { phone: phone.trim() },
        ...(err ? { description: err.message } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
      void logSecurityEvent({
        category: "auth",
        eventType: "whatsapp_otp_verify",
        status: "failure",
        description: (e as Error).message,
        detail: { phone: phone.trim() },
      });
    }
    setBusy(false);
  }

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-16">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary"><Database className="size-5" /></span>
          <div>
            <h1 className="text-lg leading-tight font-semibold">{t("platform_name")}</h1>
            <p className="font-mono text-xs text-muted-foreground">data@alazab.com</p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">{t("auth_intro")}</p>

        <div className="mt-6 space-y-2">
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void onGoogle()}>{t("continue_google")}</Button>
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void onMicrosoft()}>{t("continue_microsoft")}</Button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>—</span><span className="h-px flex-1 bg-border" /></div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
          {(["email", "whatsapp"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); reset(); }}
              className={cn("rounded-sm px-3 py-1.5 transition-colors", tab === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              {k === "email" ? t("email") : t("whatsapp")}
            </button>
          ))}
        </div>

        {tab === "email" ? (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="full_name">{t("full_name")}</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                minLength={mode === "signup" ? 15 : undefined}
                maxLength={mode === "signup" ? 20 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === "signup" ? (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <p>{lang === "ar" ? "15–20 حرفًا · A-Z / a-z / 0-9 / $ # _" : "15–20 chars · A-Z / a-z / 0-9 / $ # _"}</p>
                  {password.length && passwordErrors.length ? <p className="text-destructive">{passwordPolicyMessage(passwordErrors[0]!, lang === "ar" ? "ar" : "en")}</p> : null}
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
            {needsConfirm ? (
              <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={() => void onResend()} disabled={busy}>{t("resend_confirmation")}</button>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "signin" ? t("sign_in") : t("sign_up")}
            </Button>

            {mode === "signin" ? (
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => void onForgot()} disabled={busy}>{t("forgot_password")}</button>
            ) : null}

            <button
              type="button"
              className="w-full text-center text-xs text-primary underline-offset-4 hover:underline"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setPassword(""); reset(); }}
            >
              {mode === "signin" ? t("sign_up") : t("sign_in")}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phone_number")}</Label>
              <Input id="phone" dir="ltr" placeholder="+201000000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {otpSent ? (
              <div className="space-y-1.5">
                <Label htmlFor="otp">{t("otp_code")}</Label>
                <Input id="otp" dir="ltr" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}

            <Button type="button" className="w-full" disabled={busy || !phone.trim()} onClick={() => void (otpSent ? onVerifyOtp() : onSendOtp())}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
              {otpSent ? t("verify_otp") : t("send_otp")}
            </Button>
            {otpSent ? (
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setOtpSent(false); setOtp(""); reset(); }}>{t("change_phone")}</button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
