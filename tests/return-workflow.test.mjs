import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

function loadFunctions() {
  const file = path.join(process.cwd(), "src", "lib", "services", "return-workflow.ts");
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter((statement) =>
    ts.isFunctionDeclaration(statement) && ["calculateReturnFacts", "calculateReturnCharges"].includes(statement.name?.text ?? ""),
  );
  assert.equal(functions.length, 2);
  const transpiled = ts.transpileModule(`${functions.map((fn) => fn.getText(ast)).join("\n")}\nmodule.exports = { calculateReturnFacts, calculateReturnCharges };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { module: { exports: {} }, exports: {}, roundMoney: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100 };
  context.exports = context.module.exports;
  vm.runInNewContext(transpiled, context, { filename: file });
  return context.module.exports;
}

const { calculateReturnFacts, calculateReturnCharges } = loadFunctions();

test("limited mileage only bills kilometres above the contract allowance", () => {
  const facts = calculateReturnFacts({ checkoutMileage: 10000, returnMileage: 10300, checkoutFuel: 8, returnFuel: 8, plannedEnd: "2099-01-03T12:00:00Z", actualReturn: "2099-01-03T12:00:00Z", mileagePolicy: "LIMITED", mileageAllowance: 500 });
  assert.equal(facts.drivenMileage, 300);
  assert.equal(facts.extraMileage, 0);
  const over = calculateReturnFacts({ checkoutMileage: 10000, returnMileage: 10800, checkoutFuel: 8, returnFuel: 8, plannedEnd: "2099-01-03T12:00:00Z", actualReturn: "2099-01-03T12:00:00Z", mileagePolicy: "LIMITED", mileageAllowance: 500 });
  assert.equal(over.extraMileage, 300);
});

test("unlimited and unspecified mileage never invent an excess charge", () => {
  const unlimited = calculateReturnFacts({ checkoutMileage: 10000, returnMileage: 15000, checkoutFuel: 8, returnFuel: 8, plannedEnd: "2099-01-03T12:00:00Z", actualReturn: "2099-01-03T12:00:00Z", mileagePolicy: "UNLIMITED" });
  assert.equal(unlimited.extraMileage, 0);
  assert.equal(unlimited.mileageRuleNeedsReview, false);
  const unspecified = calculateReturnFacts({ checkoutMileage: 10000, returnMileage: 10500, checkoutFuel: 8, returnFuel: 8, plannedEnd: "2099-01-03T12:00:00Z", actualReturn: "2099-01-03T12:00:00Z", mileagePolicy: "UNSPECIFIED" });
  assert.equal(unspecified.extraMileage, 0);
  assert.equal(unspecified.mileageRuleNeedsReview, true);
});

test("return charges use the snapshotted configured rates", () => {
  const facts = calculateReturnFacts({ checkoutMileage: 10000, returnMileage: 10800, checkoutFuel: 8, returnFuel: 6, plannedEnd: "2099-01-03T12:00:00Z", actualReturn: "2099-01-04T12:00:00Z", mileagePolicy: "LIMITED", mileageAllowance: 500 });
  const rows = calculateReturnCharges(facts, { dailyRate: 300, mileageRate: 1.5, fuelRate: 75, cleaningFee: 180 }, "DIRTY");
  assert.equal(JSON.stringify(rows.map((row) => [row.charge_type, row.amount])), JSON.stringify([["LATE_RETURN", 300], ["EXTRA_MILEAGE", 450], ["FUEL", 150], ["CLEANING", 180]]));
});
