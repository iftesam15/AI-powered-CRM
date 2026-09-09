"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadEntityCsv } from "../api/queries";

interface ExportButtonProps {
  entityType: "contacts" | "accounts" | "leads" | "opportunities";
  className?: string;
}

export function ExportButton({ entityType, className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadEntityCsv(entityType);
      toast.success(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} exported to CSV successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={`gap-2 ${className || ""}`}
    >
      <Download className="size-4" />
      {isExporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
