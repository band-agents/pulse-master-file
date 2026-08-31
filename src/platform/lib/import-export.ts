/**
 * Import / Export Engine — Detailed CSV handling with validation
 *
 * محرك الاستيراد والتصدير — CSV مفصّل مع تحقق من البيانات
 */

// ─── Export ───────────────────────────────────────────────

export interface ExportConfig {
  filename: string;
  columns: { key: string; header: string }[];
  data: Record<string, unknown>[];
}

export function exportDetailedCSV(config: ExportConfig): void {
  const { columns, data, filename } = config;
  const headers = columns.map(c => c.header);
  const rows = data.map(row => columns.map(c => {
    const val = row[c.key];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    const str = String(val);
    // Escape CSV
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }));

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import ────────��──────────────────────────────────────

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  errors: { row: number; message: string; data?: Record<string, unknown> }[];
  validRows: Record<string, unknown>[];
}

export interface ImportColumn {
  key: string;
  header: string;
  required?: boolean;
  type?: "string" | "number" | "date" | "email";
  validate?: (val: string) => boolean;
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(current.trim()); current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(current.trim());
      if (row.some(c => c !== "")) rows.push(row);
      row = []; current = "";
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

export function validateAndImport(
  csvText: string,
  columns: ImportColumn[],
  existingIds?: Set<string>
): ImportResult {
  const parsed = parseCSV(csvText);
  if (parsed.length < 2) return { total: 0, success: 0, failed: 0, duplicates: 0, errors: [{ row: 0, message: "Empty or header-only file" }], validRows: [] };

  const headers = parsed[0].map(h => h.toLowerCase().trim());
  const result: ImportResult = { total: parsed.length - 1, success: 0, failed: 0, duplicates: 0, errors: [], validRows: [] };

  // Map headers to columns
  const colMap: { idx: number; col: ImportColumn }[] = [];
  columns.forEach(col => {
    const idx = headers.findIndex(h => h === col.header.toLowerCase() || h === col.key.toLowerCase());
    if (idx >= 0) colMap.push({ idx, col });
  });

  const missingRequired = columns.filter(c => c.required && !colMap.find(cm => cm.col.key === c.key));
  if (missingRequired.length > 0) {
    result.errors.push({ row: 0, message: `Missing required columns: ${missingRequired.map(c => c.header).join(", ")}` });
    result.failed = result.total;
    return result;
  }

  for (let i = 1; i < parsed.length; i++) {
    const raw = parsed[i];
    const row: Record<string, unknown> = {};
    let valid = true;

    for (const { idx, col } of colMap) {
      const val = raw[idx] ?? "";

      if (col.required && !val) {
        result.errors.push({ row: i, message: `Missing required field: ${col.header}` });
        valid = false;
        break;
      }

      if (val && col.type === "number" && isNaN(Number(val))) {
        result.errors.push({ row: i, message: `${col.header} must be a number` });
        valid = false;
        break;
      }

      if (val && col.type === "email" && !val.includes("@")) {
        result.errors.push({ row: i, message: `${col.header} must be valid email` });
        valid = false;
        break;
      }

      if (val && col.validate && !col.validate(val)) {
        result.errors.push({ row: i, message: `${col.header} validation failed`, data: { value: val } });
        valid = false;
        break;
      }

      row[col.key] = col.type === "number" ? Number(val) : val;
    }

    if (!valid) { result.failed++; continue; }

    // Duplicate check
    const id = row["sku"] || row["email"] || row["name"];
    if (existingIds && id && existingIds.has(String(id))) {
      result.duplicates++;
      result.failed++;
      result.errors.push({ row: i, message: `Duplicate: ${id}` });
      continue;
    }

    result.validRows.push(row);
    result.success++;
  }

  return result;
}

// ─── Template generators ──────────��─────────────────────

export function downloadTemplate(columns: ImportColumn[], filename: string): void {
  const headers = columns.map(c => c.header);
  const example = columns.map(c => {
    if (c.type === "number") return "0";
    if (c.type === "email") return "example@company.com";
    if (c.type === "date") return "2024-01-01";
    return "";
  });
  const csv = [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Pre-defined column configs ──────────────��──────────

export const CUSTOMER_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Name", required: true },
  { key: "name_ar", header: "Name (Arabic)" },
  { key: "phone", header: "Phone" },
  { key: "email", header: "Email", type: "email" },
  { key: "address", header: "Address" },
  { key: "tags", header: "Tags" },
];

export const PRODUCT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Product Name", required: true },
  { key: "name_ar", header: "Name (Arabic)" },
  { key: "sku", header: "SKU", required: true },
  { key: "category", header: "Category" },
  { key: "main_material", header: "Main Material" },
  { key: "unit_cost", header: "Unit Cost", type: "number" },
  { key: "price", header: "Price", type: "number" },
  { key: "description", header: "Description" },
];

export const INVENTORY_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Item Name", required: true },
  { key: "sku", header: "SKU" },
  { key: "quantity", header: "Quantity", type: "number", required: true },
  { key: "unit", header: "Unit" },
  { key: "unit_cost", header: "Unit Cost", type: "number" },
  { key: "reorder_level", header: "Reorder Level", type: "number" },
  { key: "supplier", header: "Supplier" },
  { key: "location", header: "Location" },
];

export const CONTACT_COLUMNS: ImportColumn[] = [
  { key: "name", header: "Name", required: true },
  { key: "name_ar", header: "Name (Arabic)" },
  { key: "email", header: "Email", type: "email" },
  { key: "phone", header: "Phone" },
  { key: "role", header: "Role" },
  { key: "company", header: "Company" },
];

export const BOM_COLUMNS: ImportColumn[] = [
  { key: "product_sku", header: "Product SKU", required: true },
  { key: "material", header: "Material", required: true },
  { key: "qty", header: "Quantity", type: "number", required: true },
  { key: "unit", header: "Unit" },
  { key: "cost_per_unit", header: "Cost Per Unit", type: "number" },
  { key: "supplier", header: "Supplier" },
];
