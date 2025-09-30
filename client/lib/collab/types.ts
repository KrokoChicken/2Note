export type Role = "owner" | "editor" | "viewer";

export type Collaborator = {
  id: string;
  name: string;
  image: string | null;
  role: Role;
};

// minimal awareness/provider contracts we actually use
export interface Awareness {
  getStates?: () => Map<any, any>;
  on?: (ev: "update", cb: () => void) => void;
  off?: (ev: "update", cb: () => void) => void;
  setLocalStateField?: (key: string, val: unknown) => void;
}

export interface CollabProvider {
  awareness?: Awareness | null;
}