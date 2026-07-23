import { describe, expect, it } from "vitest";
import { roleAtLeast } from "./rbac";

describe("roleAtLeast", () => {
  it("owner meets bookkeeper minimum", () => {
    expect(roleAtLeast("owner", "bookkeeper")).toBe(true);
  });
  it("owner meets owner minimum", () => {
    expect(roleAtLeast("owner", "owner")).toBe(true);
  });
  it("bookkeeper does not meet owner minimum", () => {
    expect(roleAtLeast("bookkeeper", "owner")).toBe(false);
  });
  it("bookkeeper meets bookkeeper minimum", () => {
    expect(roleAtLeast("bookkeeper", "bookkeeper")).toBe(true);
  });
});
