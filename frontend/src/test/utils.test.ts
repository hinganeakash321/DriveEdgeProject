import { describe, expect, it } from "vitest";
import { formatINR, formatPriceRange, titleCase } from "@/lib/utils";

describe("formatINR", () => {
  it("formats lakhs", () => {
    expect(formatINR(800000)).toBe("₹8.00 lakh");
  });
  it("formats crores", () => {
    expect(formatINR(12000000)).toBe("₹1.20 crore");
  });
  it("handles numeric strings", () => {
    expect(formatINR("1500000")).toBe("₹15.00 lakh");
  });
  it("handles null", () => {
    expect(formatINR(null)).toBe("N/A");
  });
});

describe("formatPriceRange", () => {
  it("shows onwards when equal", () => {
    expect(formatPriceRange(800000, 800000)).toBe("₹8.00 lakh onwards");
  });
  it("shows a range", () => {
    expect(formatPriceRange(800000, 1200000)).toBe("₹8.00 lakh - ₹12.00 lakh");
  });
});

describe("titleCase", () => {
  it("replaces underscores and capitalizes", () => {
    expect(titleCase("sent_to_dealer")).toBe("Sent To Dealer");
  });
});
