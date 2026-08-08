import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Invalid phone number");

const codeSchema = z.string().trim().regex(/^[0-9]{6}$/);

function normalizePhone(raw: string) {
  return `+${raw.replace(/[^0-9]/g, "")}`;
}

function syntheticEmail(phone: string) {
  return `wa${phone.replace(/[^0-9]/g, "")}@wa.alazab.local`;
}

async function sha256(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendWhatsapp(phone: string, code: string) {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneId) throw new Error("WhatsApp is not configured on the server");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/^\+/, ""),
      type: "text",
      text: { body: `رمز الدخول إلى منصة بيانات العزب: ${code}\nصالح لمدة 5 دقائق.` },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp send failed [${res.status}]: ${await res.text()}`);
}

export const requestWhatsappOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ phone: phoneSchema }).parse(input))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("adp_login_otp")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) >= 2) throw new Error("تم إرسال رمز مؤخراً، حاول بعد دقيقة.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabaseAdmin.from("adp_login_otp").insert({
      phone,
      code_hash: await sha256(`${phone}:${code}`),
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    if (error) throw new Error(error.message);

    await sendWhatsapp(phone, code);
    return { ok: true };
  });

export const verifyWhatsappOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ phone: phoneSchema, code: codeSchema }).parse(input))
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("adp_login_otp")
      .select("id, code_hash, attempts, consumed, expires_at")
      .eq("phone", phone)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("لا يوجد رمز نشِط لهذا الرقم.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("انتهت صلاحية الرمز.");
    if (row.attempts >= 5) throw new Error("تم تجاوز عدد المحاولات.");

    const hash = await sha256(`${phone}:${data.code}`);
    if (hash !== row.code_hash) {
      await supabaseAdmin
        .from("adp_login_otp")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("الرمز غير صحيح.");
    }
    await supabaseAdmin.from("adp_login_otp").update({ consumed: true }).eq("id", row.id);

    const email = syntheticEmail(phone);
    let link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        user_metadata: { full_name: phone, login_method: "whatsapp" },
      });
      if (created.error) throw new Error(created.error.message);
      link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error) throw new Error(link.error.message);
    }

    return {
      email,
      tokenHash: link.data.properties?.hashed_token ?? "",
    };
  });
