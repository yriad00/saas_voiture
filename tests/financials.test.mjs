import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Run the actual pure business functions locally. The server-only module and
// Supabase query wrapper are never imported or executed by these tests.
function loadFinancialCalculator() {
  const root = process.cwd();
  const utilsPath = path.join(root, "src", "lib", "utils.ts");
  const financialsPath = path.join(root, "src", "lib", "services", "financials.ts");
  const utilsSource = fs.readFileSync(utilsPath, "utf8");
  const utilsAst = ts.createSourceFile(utilsPath, utilsSource, ts.ScriptTarget.Latest, true);
  const roundMoneyFunction = utilsAst.statements.find((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "roundMoney");
  assert.ok(roundMoneyFunction, "The production roundMoney function must exist");
  const roundModule = ts.transpileModule(roundMoneyFunction.getText(utilsAst), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const roundContext = { exports: {} };
  vm.runInNewContext(roundModule, roundContext, { filename: utilsPath });
  const roundMoney = roundContext.exports.roundMoney;
  assert.equal(typeof roundMoney, "function");

  const financialsSource = fs.readFileSync(financialsPath, "utf8");
  const financialsAst = ts.createSourceFile(financialsPath, financialsSource, ts.ScriptTarget.Latest, true);
  const calculatorFunction = financialsAst.statements.find((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "calculateContractFinancials");
  assert.ok(calculatorFunction, "The production contract financial calculator must exist");
  const calculatorModule = ts.transpileModule(calculatorFunction.getText(financialsAst), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calculatorContext = { exports: {}, roundMoney };
  vm.runInNewContext(calculatorModule, calculatorContext, { filename: financialsPath });
  assert.equal(typeof calculatorContext.exports.calculateContractFinancials, "function");
  return calculatorContext.exports.calculateContractFinancials;
}

const calculateContractFinancials = loadFinancialCalculator();

test("one-way charge is included once and deposit movements are excluded from rental revenue", () => {
  const result = calculateContractFinancials({
    baseTotalAmount: 3000,
    extrasTotal: 200,
    oneWayFee: 250,
    returnChargesTotal: 100,
    payments: [
      { amount: 500, type: "RENTAL", status: "COMPLETED" },
      { amount: 2000, type: "RENTAL", status: "COMPLETED" },
      { amount: 750, type: "RENTAL", status: "COMPLETED" },
      { amount: 3000, type: "DEPOSIT", status: "COMPLETED" },
      { amount: 2050, type: "DEPOSIT_REFUND", status: "COMPLETED" },
    ],
    deposit: {
      requiredAmount: 3000,
      receivedAmount: 3000,
      heldAmount: 3000,
      deductedAmount: 950,
      refundedAmount: 2050,
    },
  });
  assert.equal(result.rentalSubtotal, 3450);
  assert.equal(result.returnChargesTotal, 100);
  assert.equal(result.grandTotal, 3550);
  assert.equal(result.rentalPaidTotal, 3250);
  assert.equal(result.paidTotal, 3250);
  assert.equal(result.amountDue, 300);
  assert.equal(result.depositAvailable, 0);
  assert.equal(result.depositReceived, 3000);
});

test("changing only the caution cannot change rental total, paid amount or balance", () => {
  const rental = {
    baseTotalAmount: 1500,
    extrasTotal: 100,
    oneWayFee: 125.5,
    payments: [
      { amount: 500, type: "RENTAL", status: "COMPLETED" },
      { amount: 1000, type: "DEPOSIT", status: "COMPLETED" },
      { amount: 400, type: "DEPOSIT_REFUND", status: "COMPLETED" },
    ],
  };
  const withDeposit = calculateContractFinancials({
    ...rental,
    deposit: {
      requiredAmount: 1000, receivedAmount: 1000, heldAmount: 1000,
      deductedAmount: 600, refundedAmount: 400,
    },
  });
  const withoutDeposit = calculateContractFinancials({ ...rental, deposit: null });
  assert.equal(withDeposit.rentalSubtotal, 1725.5);
  assert.equal(withDeposit.grandTotal, withoutDeposit.grandTotal);
  assert.equal(withDeposit.paidTotal, withoutDeposit.paidTotal);
  assert.equal(withDeposit.amountDue, withoutDeposit.amountDue);
  assert.equal(withDeposit.amountDue, 1225.5);
  assert.equal(withDeposit.depositAvailable, 0);
});

test("final invoice and receipt totals include every finalized return charge", () => {
  const result = calculateContractFinancials({
    baseTotalAmount: 3000,
    extrasTotal: 0,
    returnChargesTotal: 300 + 150 + 500,
    payments: [
      { amount: 1000, type: "RENTAL", status: "COMPLETED" },
      { amount: 500, type: "DEPOSIT", status: "COMPLETED" },
    ],
    deposit: {
      requiredAmount: 500,
      receivedAmount: 500,
      heldAmount: 500,
      deductedAmount: 500,
      refundedAmount: 0,
    },
  });
  assert.equal(result.rentalSubtotal, 3000);
  assert.equal(result.returnChargesTotal, 950);
  assert.equal(result.grandTotal, 3950);
  assert.equal(result.rentalPaidTotal, 1000);
  assert.equal(result.amountDue, 2950);
  assert.equal(result.depositAvailable, 0);
});

test("an explicit deposit deduction settles the rental balance without becoming cash revenue", () => {
  const result = calculateContractFinancials({
    baseTotalAmount: 3000,
    extrasTotal: 0,
    returnChargesTotal: 950,
    payments: [{ amount: 3000, type: "RENTAL", status: "COMPLETED" }],
    depositSettlementAmount: 950,
    deposit: { requiredAmount: 3000, receivedAmount: 3000, heldAmount: 3000, deductedAmount: 950, refundedAmount: 2050 },
  });
  assert.equal(result.grandTotal, 3950);
  assert.equal(result.rentalPaidTotal, 3000);
  assert.equal(result.paidTotal, 3000);
  assert.equal(result.depositSettlementAmount, 950);
  assert.equal(result.amountDue, 0);
  assert.equal(result.depositAvailable, 0);
});
