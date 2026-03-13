import { describe, expect, it } from "vitest";
import { getPrimaryTeam, resolveNextPrimaryTeam } from "@/lib/team-utils";

describe("team utils", () => {
  it("falls back to the only assigned team when primaryTeam is absent", () => {
    expect(getPrimaryTeam(null, ["A"])).toBe("A");
    expect(getPrimaryTeam(null, ["B"])).toBe("B");
  });

  it("falls back to the only assigned team when primaryTeam is stale", () => {
    expect(getPrimaryTeam("B", ["A"])).toBe("A");
    expect(getPrimaryTeam("A", ["B"])).toBe("B");
  });

  it("preserves the current effective primary team when adding a second team", () => {
    expect(resolveNextPrimaryTeam(["A", "B"], null, null, ["B"])).toBe("B");
    expect(resolveNextPrimaryTeam(["A", "B"], null, "A", ["A"])).toBe("A");
  });

  it("switches the primary team only when explicitly requested", () => {
    expect(resolveNextPrimaryTeam(["A", "B"], "B", "A", ["A", "B"])).toBe("B");
  });

  it("moves the primary team to the remaining team when the current one is removed", () => {
    expect(resolveNextPrimaryTeam(["B"], null, "A", ["A", "B"])).toBe("B");
    expect(resolveNextPrimaryTeam([], null, "A", ["A", "B"])).toBeNull();
  });
});
