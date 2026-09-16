"use client";

import * as XLSX from "@e965/xlsx";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ExportColumn = { key: string; label: string };

export function ExportButtons({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
}) {
  const exportRows = rows.map((row) => Object.fromEntries(columns.map((column) => [column.label, row[column.key] ?? ""])));

  function download(kind: "csv" | "xlsx") {
    const sheet = XLSX.utils.json_to_sheet(exportRows, { header: columns.map((column) => column.label) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Export");
    XLSX.writeFile(workbook, `${filename}.${kind}` , { bookType: kind === "csv" ? "csv" : "xlsx" });
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="sm" onClick={() => download("csv")} title="Exporter en CSV">
        <Download /> CSV
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => download("xlsx")} title="Exporter en Excel">
        <FileSpreadsheet /> Excel
      </Button>
    </div>
  );
}
