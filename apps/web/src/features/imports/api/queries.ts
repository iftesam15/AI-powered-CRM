import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, PROXY_BASE } from "@/lib/api-client";
import { QUERY_KEYS } from "@/lib/constants";
import type { ImportFieldsResponse, ImportPreviewResponse, ImportResult } from "../types";

export function useImportFields(entityType: string = "contacts") {
  return useQuery({
    queryKey: [...QUERY_KEYS.dataOps, "fields", entityType],
    queryFn: async () => {
      return api.get<ImportFieldsResponse>(`/data-ops/import/fields/${entityType}`);
    },
  });
}

export async function downloadImportTemplate(entityType: string = "contacts") {
  const res = await fetch(`${PROXY_BASE}/data-ops/import/template/${entityType}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Template download failed." }));
    throw new Error(err.detail || "Template download failed.");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityType}_import_template.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${PROXY_BASE}/data-ops/import/preview`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to parse CSV preview." }));
        throw new Error(err.detail || "Failed to preview CSV file.");
      }

      return (await res.json()) as ImportPreviewResponse;
    },
  });
}

export function useExecuteImport(entityType: string = "contacts") {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, mapping }: { file: File; mapping: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping_json", JSON.stringify(mapping));

      const res = await fetch(`${PROXY_BASE}/data-ops/import/execute/${entityType}`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to execute import." }));
        throw new Error(err.detail || "Failed to execute import.");
      }

      return (await res.json()) as ImportResult;
    },
    onSuccess: () => {
      if (entityType === "contacts") {
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.contacts });
      } else if (entityType === "accounts") {
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.accounts });
      } else if (entityType === "leads") {
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.leads });
      }
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.search });
    },
  });
}
