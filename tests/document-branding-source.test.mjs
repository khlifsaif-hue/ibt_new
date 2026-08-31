import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const branding=fs.readFileSync(new URL("../app/lib/document-branding.ts",import.meta.url),"utf8");
const reports=fs.readFileSync(new URL("../app/lib/report-export.ts",import.meta.url),"utf8");
const invoicing=fs.readFileSync(new URL("../app/finance/invoicing/page.tsx",import.meta.url),"utf8");

test("official documents share the Ibtechar A4 brand system",()=>{
  assert.match(branding,/Ibtechar Digital Solutions/);
  assert.match(branding,/ibtechar-main-logo\.png/);
  assert.match(branding,/@page\{size:A4/);
  assert.match(branding,/Bai Jamjuree/);
  assert.match(branding,/Tajawal/);
  assert.match(branding,/document-table thead\{display:table-header-group/);
});

test("reports retain PDF, Excel, CSV and HTML output",()=>{
  for(const format of ["pdf","xlsx","csv","html"])assert.match(reports,new RegExp(format));
  assert.match(reports,/IBTECHAR_DOCUMENT_THEME/);
  assert.match(reports,/documentStyles/);
});

test("invoice and receipt previews use the shared official document renderer",()=>{
  assert.match(invoicing,/previewOfficialDocument/);
  assert.match(invoicing,/type:"Invoice"/);
  assert.match(invoicing,/type:"Payment Receipt"/);
  assert.match(invoicing,/Preview invoice/);
});
