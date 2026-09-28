type WorkspaceContext = object | null | undefined;

type DashboardAccessInput = {
  authLoaded: boolean;
  hasAuthUser: boolean;
  convexAuthLoading: boolean;
  convexAuthenticated: boolean;
  contextRequired: boolean;
  workspaceContext: WorkspaceContext;
  publicLookupRequired: boolean;
  publicId: string | null | undefined;
};

export type DashboardAccessState =
  | { kind: "loading" }
  | { kind: "dashboard" }
  | { kind: "redirect-public"; publicId: string }
  | { kind: "redirect-sign-in" }
  | { kind: "not-found" }
  | { kind: "auth-unavailable" };

export function resolveDashboardAccess(input: DashboardAccessInput): DashboardAccessState {
  if (!input.authLoaded) {
    return { kind: "loading" };
  }

  if (!input.hasAuthUser) {
    if (input.publicLookupRequired && input.publicId === undefined) {
      return { kind: "loading" };
    }
    if (input.publicLookupRequired && input.publicId) {
      return { kind: "redirect-public", publicId: input.publicId };
    }
    return { kind: "redirect-sign-in" };
  }

  if (input.convexAuthLoading) {
    return { kind: "loading" };
  }

  if (!input.convexAuthenticated) {
    if (input.publicLookupRequired && input.publicId === undefined) {
      return { kind: "loading" };
    }
    if (input.publicLookupRequired && input.publicId) {
      return { kind: "redirect-public", publicId: input.publicId };
    }
    return { kind: "auth-unavailable" };
  }

  if (!input.contextRequired) {
    return { kind: "dashboard" };
  }

  if (input.workspaceContext === undefined) {
    return { kind: "loading" };
  }

  if (input.workspaceContext !== null) {
    return { kind: "dashboard" };
  }

  if (input.publicLookupRequired && input.publicId === undefined) {
    return { kind: "loading" };
  }

  if (input.publicLookupRequired && input.publicId) {
    return { kind: "redirect-public", publicId: input.publicId };
  }

  return { kind: "not-found" };
}
