import { createContext } from "react";
import { type CreativeTemplate as Template } from "@/lib/api/templates";

// Who liked what: the slugs this visitor liked, and the counts that changed after the page loaded.
type LikesState = { liked: Set<string>; counts: Record<string, number>; toggle: (t: Template) => void };

export const LikesContext = createContext<LikesState>({ liked: new Set(), counts: {}, toggle: () => {} });
