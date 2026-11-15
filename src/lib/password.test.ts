import { describe, expect, it } from "vitest";
import { generatePassword } from "@/lib/password";

describe("generatePassword", () => {
  it("has the requested length and only unambiguous characters", () => {
    for (const length of [8, 12, 30]) {
      const password = generatePassword(length);
      expect(password).toHaveLength(length);
      expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
    }
  });

  it("differs every time", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(passwords.size).toBe(50);
  });

  it("fits what the API accepts", () => {
    expect(new TextEncoder().encode(generatePassword()).length).toBeLessThanOrEqual(72);
    expect(generatePassword().length).toBeGreaterThanOrEqual(8);
  });
});
