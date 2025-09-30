export const EMPTY_SET: ReadonlySet<string> = new Set();

export function uniqueBumpToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function readOnlineIdsFromAwareness(aw?: any): ReadonlySet<string> {
  if (!aw?.getStates) return EMPTY_SET;
  const ids = new Set<string>();
  for (const s of aw.getStates().values() as Iterable<any>) {
    const id = s?.user?.id ?? s?.userId;
    if (id != null) ids.add(String(id));
  }
  return ids;
}

export function readNewestRolesToken(aw?: any): string | null {
  if (!aw?.getStates) return null;
  let newest: string | null = null;
  for (const st of aw.getStates().values() as Iterable<any>) {
    const t = typeof st?.rolesBump === "string" ? st.rolesBump : null;
    if (t && (!newest || t > newest)) newest = t;
  }
  return newest;
}