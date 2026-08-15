const contracts = await import("../dist/index.js");

if (!Array.isArray(contracts.SKILL_CODES) || contracts.SKILL_CODES.length !== 5) {
  throw new Error("contracts runtime entrypoint did not export the approved skill catalog");
}
