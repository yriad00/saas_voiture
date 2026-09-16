import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loadCalculator() {
  const file = path.join(process.cwd(), "src", "lib", "services", "financial-documents.ts");
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "calculateFinancialDocumentTotals");
  assert.ok(fn);
  const output = ts.transpileModule(`${fn.getText(ast)}\nmodule.exports = { calculateFinancialDocumentTotals };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { module: { exports: {} }, exports: {}, roundMoney: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100 };
  context.exports = context.module.exports;
  vm.runInNewContext(output, context, { filename: file });
  return context.module.exports.calculateFinancialDocumentTotals;
}

const calculate = loadCalculator();

test("invoice uses final adjusted rental total while receipt uses money actually received", () => {
  const financials = { grandTotal: 3950, paidTotal: 3000 };
  assert.deepEqual(JSON.parse(JSON.stringify(calculate(financials, "INVOICE", 0))), { subtotal: 3950, taxRate: 0, taxAmount: 0, totalAmount: 3950 });
  assert.deepEqual(JSON.parse(JSON.stringify(calculate(financials, "RECEIPT", 0))), { subtotal: 3000, taxRate: 0, taxAmount: 0, totalAmount: 3000 });
});

test("document tax is applied consistently without changing the underlying rental total", () => {
  const invoice = calculate({ grandTotal: 3950, paidTotal: 3950 }, "INVOICE", 20);
  assert.equal(invoice.subtotal, 3291.67);
  assert.equal(invoice.taxAmount, 658.33);
  assert.equal(invoice.totalAmount, 3950);
  const receipt = calculate({ grandTotal: 3950, paidTotal: 1000 }, "RECEIPT", 20);
  assert.equal(receipt.subtotal, 833.33);
  assert.equal(receipt.taxAmount, 166.67);
  assert.equal(receipt.totalAmount, 1000);
  const quote = calculate({ grandTotal: 3950, paidTotal: 0 }, "QUOTE", 20);
  assert.equal(quote.taxRate, 20);
  assert.equal(quote.subtotal, 3291.67);
  assert.equal(quote.taxAmount, 658.33);
  assert.equal(quote.totalAmount, 3950);
});
