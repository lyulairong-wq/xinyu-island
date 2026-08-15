const safetyPackage = await import("../dist/index.js");

if (typeof safetyPackage.evaluateMessage !== "function") {
  throw new Error("Safety package entrypoint did not export evaluateMessage.");
}

if (!Array.isArray(safetyPackage.SAFETY_REGRESSION_CASES)) {
  throw new Error("Safety package entrypoint did not export SAFETY_REGRESSION_CASES.");
}
