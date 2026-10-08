import {
  Briefcase,
  Building2,
  Car,
  ContactRound,
  CreditCard,
  Droplets,
  FileText,
  Gauge,
  House,
  Landmark,
  Percent,
  Receipt,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { OcrDocumentTypeId } from "@/lib/api/document-ocr";

/** Order matches the iApp OCR catalogue; `id` matches the backend registry. */
export const OCR_DOCUMENT_TYPE_OPTIONS: ReadonlyArray<{ id: OcrDocumentTypeId; icon: LucideIcon }> = [
  { id: "general", icon: FileText },
  { id: "receipt", icon: Receipt },
  { id: "bank-statement", icon: Landmark },
  { id: "credit-card-statement", icon: CreditCard },
  { id: "ncb-credit-report", icon: Gauge },
  { id: "tax-deduction-certificate", icon: Percent },
  { id: "electricity-bill", icon: Zap },
  { id: "water-bill", icon: Droplets },
  { id: "vehicle-registration", icon: Car },
  { id: "company-certificate", icon: Building2 },
  { id: "civil-registration", icon: House },
  { id: "curriculum-vitae", icon: ContactRound },
  { id: "job-description", icon: Briefcase },
];

/** Used until the backend type list loads, and if it cannot be reached. */
export const DEFAULT_OCR_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;
export const DEFAULT_OCR_MAX_MEGABYTES = 10;
