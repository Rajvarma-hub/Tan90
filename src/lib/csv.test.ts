import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a header and rows separated by CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["n"], [["a,b"], ['say "hi"'], ["two\nlines"]])).toBe(
      'n\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"\r\n',
    );
  });

  it("leaves empty values blank and keeps numbers and booleans", () => {
    expect(toCsv(["a", "b", "c", "d"], [[null, undefined, 0, false]])).toBe("a,b,c,d\r\n,,0,false\r\n");
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd"])("defuses a formula-looking text %j", (text) => {
    expect(toCsv(["v"], [[text]])).toBe(`v\r\n'${text}\r\n`);
  });

  it("does not touch a negative number", () => {
    expect(toCsv(["v"], [[-5]])).toBe("v\r\n-5\r\n");
  });
});
