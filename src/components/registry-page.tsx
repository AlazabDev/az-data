import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RecordDialog, type FieldSpec } from "@/components/record-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useDeleteRow, useRows, useSaveRow, type RegistryTable } from "@/lib/registry-hooks";

export type Column<T> = {
  key: string;
  labelKey: string;
  render: (row: T) => ReactNode;
};

export function RegistryPage<T extends { id: string }>({
  table,
  titleKey,
  descriptionKey,
  columns,
  fields,
  searchOf,
  orderBy = "name",
}: {
  table: RegistryTable;
  titleKey: string;
  descriptionKey?: string;
  columns: Column<T>[];
  fields: FieldSpec[];
  searchOf: (row: T) => string;
  orderBy?: string;
}) {
  const { t } = useI18n();
  const { canWrite } = useAuth();
  const rows = useRows<T>(table, orderBy, true);
  const save = useSaveRow(table);
  const remove = useDeleteRow(table);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.data ?? [];
    if (!q) return list;
    return list.filter((r) => searchOf(r).toLowerCase().includes(q));
  }, [rows.data, query, searchOf]);

  return (
    <AppShell
      title={t(titleKey)}
      description={descriptionKey ? t(descriptionKey) : undefined}
      actions={
        canWrite ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setError(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("add")}
          </Button>
        ) : null
      }
    >
      {!canWrite ? (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t("read_only_notice")}
        </p>
      ) : null}

      <div className="mb-4 max-w-sm">
        <Input
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs tracking-wide text-muted-foreground uppercase">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 text-start font-medium whitespace-nowrap">
                  {t(c.labelKey)}
                </th>
              ))}
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                  {t("loading")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                  {t("no_records")}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 align-top">
                      {c.render(row)}
                    </td>
                  ))}
                  {canWrite ? (
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(row as unknown as Record<string, unknown>);
                          setError(null);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (!window.confirm(t("confirm_delete"))) return;
                          remove.mutate(row.id, {
                            onSuccess: () => toast.success(t("deleted")),
                            onError: (e) => toast.error((e as Error).message),
                          });
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RecordDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? t("edit") : t("add")}
        fields={fields}
        initial={editing}
        busy={save.isPending}
        error={error}
        onSubmit={(values) =>
          save.mutate(values, {
            onSuccess: () => {
              toast.success(t("saved"));
              setOpen(false);
            },
            onError: (e) => setError((e as Error).message),
          })
        }
      />
    </AppShell>
  );
}
