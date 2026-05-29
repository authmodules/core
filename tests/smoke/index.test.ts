import { describe, expect, it } from "vitest";

import { AUTHMODULES_CORE_PACKAGE } from "../../src/index.js";

describe("@authmodules/core", () => {
  it("exports the package marker", () => {
    expect(AUTHMODULES_CORE_PACKAGE).toBe("@authmodules/core");
  });
});
