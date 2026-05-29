import { describe, expect, it } from "vitest";

import * as core from "../../src/index.js";
import { AUTHMODULES_CORE_PACKAGE } from "../../src/index.js";

describe("@authmodules/core public API", () => {
  it("exports the package marker", () => {
    expect(AUTHMODULES_CORE_PACKAGE).toBe("@authmodules/core");
  });

  it("keeps the source entrypoint explicit", () => {
    expect(Object.keys(core)).toEqual([
      "AUTHMODULES_CORE_PACKAGE",
      "createIdentity",
      "createIdentityId",
      "createIdentityProvider",
      "createIdentitySubject",
      "createSession",
      "createSessionId",
      "createUser",
      "createUserId",
      "getSession",
      "signInWithIdentity",
    ]);
  });
});
