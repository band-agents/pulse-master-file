import { describe, it, expect } from "vitest";
import { DataError, isDataError } from "./errors";

describe("DataError", () => {
  it("formats a diagnosable message", () => {
    const e = new DataError("create", "procurement_orders", "RLS policy violation", { workspaceId: "ws1" });
    expect(e.message).toBe('create on "procurement_orders" failed: RLS policy violation');
    expect(e.name).toBe("DataError");
    expect(e.op).toBe("create");
    expect(e.table).toBe("procurement_orders");
    expect(e.workspaceId).toBe("ws1");
  });

  it("keeps the underlying cause for Sentry", () => {
    const cause = { code: "PGRST301", message: "JWT expired" };
    const e = new DataError("list", "invoices", "JWT expired", { cause });
    expect(e.cause).toBe(cause);
  });

  it("isDataError matches real instances", () => {
    expect(isDataError(new DataError("get", "people", "x"))).toBe(true);
  });

  it("isDataError duck-types across bundle boundaries", () => {
    // A DataError constructed in another chunk (or a test page context)
    // is not `instanceof` this class — the name check must still match.
    const foreign = Object.assign(new Error("update failed"), { name: "DataError", op: "update", table: "deals" });
    expect(isDataError(foreign)).toBe(true);
  });

  it("isDataError rejects everything else", () => {
    expect(isDataError(new Error("plain"))).toBe(false);
    expect(isDataError(null)).toBe(false);
    expect(isDataError(undefined)).toBe(false);
    expect(isDataError("DataError")).toBe(false);
  });
});
