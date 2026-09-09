"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { downloadImportTemplate, useExecuteImport, useImportFields, usePreviewImport } from "../api/queries";
import type { ImportPreviewResponse, ImportResult } from "../types";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ENTITY_TYPE = "contacts";

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<ImportPreviewResponse | null>(null);
  const [columnMapping, setColumnMapping] = React.useState<Record<string, string>>({});
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = React.useState(false);

  const { data: fieldsData } = useImportFields(ENTITY_TYPE);
  const previewMutation = usePreviewImport();
  const executeMutation = useExecuteImport(ENTITY_TYPE);

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    setErrorMsg(null);
    try {
      await downloadImportTemplate(ENTITY_TYPE);
      toast.success("Template downloaded");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to download template.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Auto-map headers to fields based on string matching
  const autoMapHeaders = (headers: string[], fields: Array<{ value: string; label: string }>) => {
    const newMapping: Record<string, string> = {};
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = fields.find((f) => {
        const normVal = f.value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const normLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          normalizedHeader === normVal ||
          normalizedHeader === normLabel ||
          normalizedHeader.includes(normVal) ||
          normVal.includes(normalizedHeader)
        );
      });
      if (match) {
        newMapping[header] = match.value;
      }
    });
    setColumnMapping(newMapping);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSelectedFile(file);

    try {
      const preview = await previewMutation.mutateAsync(file);
      setPreviewData(preview);
      if (fieldsData?.fields) {
        autoMapHeaders(preview.headers, fieldsData.fields);
      }
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse CSV file.");
    }
  };

  const handleMappingChange = (header: string, field: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (field === "_ignore") {
        delete next[header];
      } else {
        next[header] = field;
      }
      return next;
    });
  };

  const handleExecuteImport = async () => {
    if (!selectedFile) return;
    setErrorMsg(null);

    try {
      const result = await executeMutation.mutateAsync({
        file: selectedFile,
        mapping: columnMapping,
      });
      setImportResult(result);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Import execution failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Progress Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center size-8 rounded-full text-xs font-semibold ${
              step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            1
          </div>
          <span className={`text-sm font-medium ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
            Upload CSV
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />

          <div
            className={`flex items-center justify-center size-8 rounded-full text-xs font-semibold ${
              step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </div>
          <span className={`text-sm font-medium ${step >= 2 ? "text-foreground" : "text-muted-foreground"}`}>
            Map Columns
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />

          <div
            className={`flex items-center justify-center size-8 rounded-full text-xs font-semibold ${
              step === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
          <span className={`text-sm font-medium ${step === 3 ? "text-foreground" : "text-muted-foreground"}`}>
            Results Summary
          </span>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Import Error</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Upload CSV */}
      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>CSV template</CardTitle>
                <CardDescription>
                  Download a file with the exact column headers the importer expects. Keep the header row,
                  replace the sample rows with your data, then upload below.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-2"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
              >
                <Download className="size-4" />
                {isDownloadingTemplate ? "Downloading..." : "Download template"}
              </Button>
            </CardHeader>
            <CardContent>
              {fieldsData?.fields?.length ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Required: at least <span className="font-medium text-foreground">First Name</span> or{" "}
                    <span className="font-medium text-foreground">Last Name</span> per row. Columns:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fieldsData.fields.map((field) => (
                      <Badge key={field.value} variant="secondary" className="font-normal">
                        {field.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading schema columns…</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Select CSV File to Import</CardTitle>
              <CardDescription>
                Upload a UTF-8 encoded .csv file. Column headers can match the template labels for automatic mapping.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <FileSpreadsheet className="size-10 text-primary" />
              </div>
              <label htmlFor="csv-upload-input" className="cursor-pointer">
                <Button variant="default" className="gap-2 pointer-events-none" disabled={previewMutation.isPending}>
                  <Upload className="size-4" />
                  {previewMutation.isPending ? "Parsing CSV..." : "Choose CSV File"}
                </Button>
                <input
                  id="csv-upload-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-muted-foreground mt-3">Maximum recommended rows: 5,000 rows per batch.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Column Mapping & Sample Preview */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Map CSV Columns to Contact Fields</CardTitle>
                <CardDescription>
                  Match your CSV column headers to CRM contact properties. Total rows detected: {previewData.total_rows}
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <FileSpreadsheet className="size-3" />
                {selectedFile?.name}
              </Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">CSV Header</TableHead>
                    <TableHead className="w-1/3">CRM Contact Field</TableHead>
                    <TableHead className="w-1/3">Sample Value (Row 1)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.headers.map((header) => {
                    const mappedVal = columnMapping[header] || "_ignore";
                    const sampleVal = previewData.sample_rows[0]?.values[header] || "";
                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={mappedVal}
                            onValueChange={(val) => handleMappingChange(header, val)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Do not import" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_ignore">
                                <span className="text-muted-foreground">-- Ignore column --</span>
                              </SelectItem>
                              {fieldsData?.fields.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label} ({f.value})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm font-mono truncate max-w-[200px]">
                          {sampleVal || <span className="italic opacity-50">Empty</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setSelectedFile(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleExecuteImport}
                disabled={executeMutation.isPending || Object.keys(columnMapping).length === 0}
                className="gap-2"
              >
                {executeMutation.isPending ? "Importing Contacts..." : "Start Import"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Step 3: Import Results */}
      {step === 3 && importResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-6 text-emerald-600" />
              <CardTitle>Import Complete</CardTitle>
            </div>
            <CardDescription>
              Processed {importResult.total_rows} rows from your CSV file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{importResult.total_rows}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <div className="text-2xl font-bold">{importResult.created_count}</div>
                <div className="text-xs">Successfully Created</div>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  importResult.error_count > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <div className="text-2xl font-bold">{importResult.error_count}</div>
                <div className="text-xs">Failed Rows</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-destructive">Validation Errors</h4>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row #</TableHead>
                        <TableHead className="w-32">Field</TableHead>
                        <TableHead>Error Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{err.row}</TableCell>
                          <TableCell className="font-medium text-xs">{err.field}</TableCell>
                          <TableCell className="text-xs text-destructive">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setSelectedFile(null);
                setPreviewData(null);
                setColumnMapping({});
                setImportResult(null);
              }}
            >
              Import Another File
            </Button>
            <Button onClick={() => router.push("/contacts")}>View Contacts List</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
