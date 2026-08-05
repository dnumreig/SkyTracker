import { describe, it, expect } from "vitest";
import { clampEndpointToBand, stubOffset } from "./deplines-geometry";

describe("clampEndpointToBand", () => {
  it("returns the center unchanged and stub 'none' when inside the band", () => {
    expect(clampEndpointToBand(50, 10, 100)).toEqual({ y: 50, stub: "none" });
  });
  it("clamps to bandTop with stub 'top' when above the band", () => {
    expect(clampEndpointToBand(-20, 10, 100)).toEqual({ y: 10, stub: "top" });
  });
  it("clamps to bandBottom with stub 'bottom' when below the band", () => {
    expect(clampEndpointToBand(180, 10, 100)).toEqual({ y: 100, stub: "bottom" });
  });
  it("treats the exact edges as inside (no stub)", () => {
    expect(clampEndpointToBand(10, 10, 100)).toEqual({ y: 10, stub: "none" });
    expect(clampEndpointToBand(100, 10, 100)).toEqual({ y: 100, stub: "none" });
  });
});

describe("stubOffset", () => {
  it("is zero for the first item in a group", () => {
    expect(stubOffset(0)).toBe(0);
  });
  it("alternates sign and grows with index", () => {
    expect(stubOffset(1)).toBe(8);
    expect(stubOffset(2)).toBe(-8);
    expect(stubOffset(3)).toBe(16);
    expect(stubOffset(4)).toBe(-16);
  });
  it("honors a custom step", () => {
    expect(stubOffset(1, 10)).toBe(10);
    expect(stubOffset(2, 10)).toBe(-10);
  });
});
