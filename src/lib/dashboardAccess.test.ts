import assert from "node:assert/strict";
import test from "node:test";

import { resolveDashboardAccess } from "./dashboardAccess";

const authenticated = {
  authLoaded: true,
  hasAuthUser: true,
  convexAuthLoading: false,
  convexAuthenticated: true,
  contextRequired: true,
  workspaceContext: {},
  publicLookupRequired: true,
  publicId: "public-video",
} as const;

test("waits for Convex authentication before allowing protected dashboard content", () => {
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      convexAuthLoading: true,
      convexAuthenticated: false,
      workspaceContext: undefined,
    }),
    { kind: "loading" },
  );
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      convexAuthenticated: false,
      workspaceContext: undefined,
      publicId: null,
    }),
    { kind: "auth-unavailable" },
  );
});

test("uses public playback when the auth server has a user but Convex auth settles unauthenticated", () => {
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      convexAuthenticated: false,
      workspaceContext: undefined,
    }),
    { kind: "redirect-public", publicId: "public-video" },
  );
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      convexAuthenticated: false,
      workspaceContext: undefined,
      publicId: undefined,
    }),
    { kind: "loading" },
  );
});

test("keeps authenticated team members on the dashboard", () => {
  assert.deepEqual(resolveDashboardAccess(authenticated), { kind: "dashboard" });
});

test("redirects anonymous viewers and authenticated non-members to public playback", () => {
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      hasAuthUser: false,
      convexAuthenticated: false,
      workspaceContext: undefined,
    }),
    { kind: "redirect-public", publicId: "public-video" },
  );
  assert.deepEqual(resolveDashboardAccess({ ...authenticated, workspaceContext: null }), {
    kind: "redirect-public",
    publicId: "public-video",
  });
});

test("does not expose private or missing videos to authenticated non-members", () => {
  assert.deepEqual(
    resolveDashboardAccess({ ...authenticated, workspaceContext: null, publicId: null }),
    { kind: "not-found" },
  );
});

test("sends anonymous private links to sign in without mounting dashboard content", () => {
  assert.deepEqual(
    resolveDashboardAccess({
      ...authenticated,
      hasAuthUser: false,
      convexAuthenticated: false,
      workspaceContext: undefined,
      publicId: null,
    }),
    { kind: "redirect-sign-in" },
  );
});
