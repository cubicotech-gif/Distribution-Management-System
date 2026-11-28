import type { User, WhRole } from "./types";
import { useUser } from "./store";

export type WhAction = "inbound" | "putaway" | "locations" | "count" | "returns" | "pick" | "pack" | "dispatch" | "stock";
const ALL: WhAction[] = ["inbound", "putaway", "locations", "count", "returns", "pick", "pack", "dispatch", "stock"];
export const MATRIX: Record<WhRole, WhAction[]> = {
  storekeeper: ALL,
  picker: ["pick", "pack"],
  loader: ["dispatch"],
};
export const WH_ROLE_LABEL: Record<WhRole, string> = { storekeeper: "Storekeeper", picker: "Picker", loader: "Loader" };

/** Can this person do this warehouse job? Anyone who is not warehouse staff cannot. */
export function can(user: User | null | undefined, action: WhAction) {
  if (!user || user.role !== "warehouse") return false;
  return MATRIX[user.whRole ?? "storekeeper"].includes(action);
}
export const useCan = (action: WhAction) => can(useUser(), action);

export const ACTION_BY_PATH: [string, WhAction][] = [
  ["/receiving", "inbound"], ["/putaway", "putaway"], ["/locations", "locations"], ["/counts", "count"],
  ["/returns", "returns"], ["/pick", "pick"], ["/pack", "pack"], ["/dispatch", "dispatch"],
];
export const homeFor = (u: User) => (u.whRole === "picker" ? "/pick" : u.whRole === "loader" ? "/dispatch" : null);
