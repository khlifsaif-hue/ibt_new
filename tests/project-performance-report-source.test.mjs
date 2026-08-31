import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const report=fs.readFileSync(new URL("../app/components/project-performance-reports.tsx",import.meta.url),"utf8");
const panel=fs.readFileSync(new URL("../app/components/project-control-panel.tsx",import.meta.url),"utf8");

test("Tasks, Activities and KPIs reporting uses live filtered SmartCare records",()=>{
  assert.match(panel,/ProjectPerformanceReports items=\{visible\} risks=\{risks\}/);
  assert.match(panel,/filters=\{\{Type:typeFilter/);
  assert.match(report,/Weighted progress/);
  assert.match(report,/Schedule compliance/);
  assert.match(report,/KPI attainment/);
  assert.match(report,/Owner workload/);
  assert.match(report,/Open risk exposure/);
});

test("performance reports support all controlled export formats and an audit register",()=>{
  for(const format of ["pdf","xlsx","csv","html"])assert.match(report,new RegExp(`value=\\"${format}\\"`));
  assert.match(report,/exportReport/);
  assert.match(report,/Work type/);
  assert.match(report,/KPI target/);
  assert.match(report,/KPI current/);
  assert.match(report,/underlying register for auditability/);
});

test("every performance visual opens an evidence drill-down",()=>{
  assert.match(report,/setDrilldown/);
  assert.match(report,/aria-label={`View \$\{label\} details`}/);
  assert.match(report,/Dashboard drill-down/);
  assert.match(report,/drilldown\.items\.map/);
  assert.match(report,/drilldown\.risks\.map/);
});
