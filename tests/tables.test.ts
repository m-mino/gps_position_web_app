import { describe, expect, it } from "vitest";
import { formatCellValue, isDataTableName } from "../src/services/tables";

describe("tables", () => {
  it("accepts known table names only", () => {
    expect(isDataTableName("positions")).toBe(true);
    expect(isDataTableName("users")).toBe(true);
    expect(isDataTableName("sqlite_master")).toBe(false);
    expect(isDataTableName(undefined)).toBe(false);
  });

  it("hides secret-like values", () => {
    expect(formatCellValue("hashed-password", "presence")).toBe("設定済み");
    expect(formatCellValue(null, "presence")).toBe("未設定");
    expect(formatCellValue("abcdef0123456789", "mask")).toBe("••••••••");
    expect(formatCellValue("abcdefghijklmnopqrstuvwxyz", "truncate")).toBe("abcdefgh…");
    expect(formatCellValue(12.5)).toBe("12.5");
    expect(formatCellValue(null)).toBe("");
  });
});
