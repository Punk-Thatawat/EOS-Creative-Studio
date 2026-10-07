import { Briefcase, FileSignature, Handshake, House, Landmark, Lock, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import type { ContractTypeId } from "@/lib/api/document-contract";

export const CONTRACT_TYPE_OPTIONS: ReadonlyArray<{ id: ContractTypeId; icon: LucideIcon }> = [
  { id: "auto", icon: Sparkles },
  { id: "rental", icon: House },
  { id: "employment", icon: Briefcase },
  { id: "service", icon: Handshake },
  { id: "loan", icon: Landmark },
  { id: "sale", icon: ShoppingCart },
  { id: "nda", icon: Lock },
  { id: "other", icon: FileSignature },
];

/** Which sides a reader of each kind of contract can be; the AI judges risk from that side. */
export const CONTRACT_PARTIES: Record<ContractTypeId, readonly string[]> = {
  auto: [],
  rental: ["tenant", "landlord"],
  employment: ["employee", "employer"],
  service: ["contractor", "client"],
  loan: ["borrower", "lender"],
  sale: ["buyer", "seller"],
  nda: ["recipient", "discloser"],
  other: [],
};
