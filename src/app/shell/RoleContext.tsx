/**
 * Working role.
 *
 * The role a person is currently working as, which decides what the Hub
 * promotes. It is explicitly NOT a permission: access control lives in
 * `platform/lib/permissions`, and switching role here never grants anything.
 * Making that separation visible is the point — a nurse who switches to the
 * pharmacy view to answer a question should not silently acquire the ability
 * to dispense.
 *
 * The choice is remembered per browser, because people work the same job
 * every day and re-picking it each morning is friction with no benefit.
 */

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react";
import { storageKey } from "@/platform/lib/brand";
import { ROLES, type Role } from "@/modules/types";

const KEY = storageKey("role");
const DEFAULT_ROLE: Role = "physician";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  /** All roles, for the switcher. */
  roles: typeof ROLES;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readStored(): Role {
  try {
    const raw = window.localStorage.getItem(KEY);
    // Guard against a stored value from an older build whose role list differed.
    if (raw && ROLES.some((r) => r.id === raw)) return raw as Role;
  } catch {
    /* storage blocked — fall through to the default */
  }
  return DEFAULT_ROLE;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readStored);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      window.localStorage.setItem(KEY, r);
    } catch {
      // A role that does not persist is a small annoyance, not an error.
    }
  }, []);

  const value = useMemo(() => ({ role, setRole, roles: ROLES }), [role, setRole]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
