import { PROXY_BASE } from "@/lib/api-client";

export async function downloadEntityCsv(entityType: string) {
  const res = await fetch(`${PROXY_BASE}/data-ops/export/${entityType}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "CSV export failed." }));
    throw new Error(err.detail || "CSV export failed.");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityType}_export.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
