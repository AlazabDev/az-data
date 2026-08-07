import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FieldSpec = {
  name: string;
  labelKey: string;
  type: "text" | "textarea" | "number" | "select" | "datetime" | "boolean";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  full?: boolean;
};

function toLocalInput(value: unknown) {
  if (!value || typeof value !== "string") return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RecordDialog({
  open,
  onOpenChange,
  title,
  fields,
  initial,
  onSubmit,
  busy,
  error,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fields: FieldSpec[];
  initial?: Record<string, unknown> | null;
  onSubmit: (values: Record<string, unknown>) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = initial?.[f.name];
      next[f.name] = f.type === "datetime" ? toLocalInput(raw) : (raw ?? (f.type === "boolean" ? false : ""));
    }
    if (initial?.["id"]) next["id"] = initial["id"];
    setValues(next);
  }, [open, initial, fields]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    if (values["id"]) payload["id"] = values["id"];
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "number") payload[f.name] = v === "" || v == null ? null : Number(v);
      else if (f.type === "datetime")
        payload[f.name] = v === "" || v == null ? null : new Date(String(v)).toISOString();
      else if (f.type === "boolean") payload[f.name] = Boolean(v);
      else payload[f.name] = v === "" ? null : v;
    }
    onSubmit(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div
              key={f.name}
              className={f.full || f.type === "textarea" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
            >
              <Label htmlFor={f.name}>{t(f.labelKey)}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                  rows={3}
                />
              ) : f.type === "select" ? (
                <select
                  id={f.name}
                  required={f.required}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                >
                  <option value="">{t("select")}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "boolean" ? (
                <div className="flex h-9 items-center">
                  <Switch
                    id={f.name}
                    checked={Boolean(values[f.name])}
                    onCheckedChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  />
                </div>
              ) : (
                <Input
                  id={f.name}
                  type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}
            </div>
          ))}

          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
