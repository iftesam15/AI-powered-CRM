import { ImportWizard } from "@/features/imports/components/import-wizard";

export default function ImportsPage() {
  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Imports</h1>
        <p className="text-muted-foreground text-sm">
          Import contacts from CSV files into your CRM database with custom column mapping and automated validation.
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
