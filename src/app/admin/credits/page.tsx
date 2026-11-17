"use client";

import { TopupPackages } from "./topup-packages";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { SidebarNavigation } from "@/components/app-shell/navigation";
import { StudioHeader } from "@/components/app-shell/studio-header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { rowKey } from "./pricing-rows";
import { PromptAddonsDialog } from "./prompt-addons-dialog";
import { PricingVariablesPanel } from "./pricing-variables-panel";
import { useCreditsPricingAdmin } from "./use-credits-pricing-admin";
import { CreditsPageHeader } from "./credits-page-header";
import { CreditsAlerts } from "./credits-alerts";
import { CreditsSummary } from "./credits-summary";
import { SignupBonusCard } from "./signup-bonus-card";
import { GlobalRulesCard } from "./global-rules-card";
import { PricingPreviewCard } from "./pricing-preview-card";
import { ModelPricingSection } from "./model-pricing-section";

function AdminCreditsContent() {
  const pricing = useCreditsPricingAdmin();
  const {
    quotes,
    quotesLoading,
    openConfigKey,
    setOpenConfigKey,
    setOpenAddonKey,
    scenarioLoadingKey,
    updateScenarioValue,
    updateDraft,
    configuredRow,
    addonRow,
    addonDraft,
    configuredPreview,
    configuredValues,
  } = pricing;

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-background">
        <SidebarNavigation />
        <div className="min-w-0 xl:pl-[var(--sidebar-width)]">
          <StudioHeader />
          <main data-no-translate className="page-gutter mx-auto w-full max-w-[1600px] py-5 lg:py-8">
            <TopupPackages />
            <div className="min-h-[calc(100vh-120px)] overflow-x-clip rounded-3xl bg-[#faf8f6] px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
              <div className="mx-auto max-w-[1240px] pt-6 lg:pt-8">
                <CreditsPageHeader pricing={pricing} />

                <CreditsAlerts pricing={pricing} />

                <CreditsSummary pricing={pricing} />

                <SignupBonusCard pricing={pricing} />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
                  <GlobalRulesCard pricing={pricing} />

                  <PricingPreviewCard pricing={pricing} />
                </div>

                <ModelPricingSection pricing={pricing} />
                {addonRow && addonDraft ? (
                  <PromptAddonsDialog
                    key={rowKey(addonRow)}
                    row={addonRow}
                    value={addonDraft.promptAddonsJson}
                    onApply={(nextValue) => {
                      updateDraft(addonRow, { promptAddonsJson: nextValue });
                      setOpenAddonKey("");
                    }}
                    onClose={() => setOpenAddonKey("")}
                  />
                ) : null}
                {configuredRow ? (
                  <PricingVariablesPanel
                    row={configuredRow}
                    values={configuredValues}
                    preview={configuredPreview}
                    loading={
                      (quotesLoading && !quotes[openConfigKey]) ||
                      scenarioLoadingKey === openConfigKey
                    }
                    onChange={(name, value) =>
                      updateScenarioValue(configuredRow, name, value)
                    }
                    onClose={() => setOpenConfigKey("")}
                  />
                ) : null}

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#eaded6] bg-[#fffdfb] p-4 text-xs text-muted-foreground">
                  <Info className="mt-0.5 shrink-0 text-primary" size={16} />
                  <p>
                    <strong className="text-foreground">วิธีเลือกกฎ:</strong>{" "}
                    ระบบจะหา rule ที่ตรงกับ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      provider + model + feature
                    </code>{" "}
                    ก่อน ถ้าไม่มีจะใช้ rule ของ model และสุดท้ายจึงใช้ global
                    fallback จาก environment เช่น{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      CREDIT_TARGET_MARGIN
                    </code>{" "}
                    และ{" "}
                    <code className="rounded bg-[#f2ece7] px-1 py-0.5 text-[11px]">
                      USD_THB_RATE
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminCreditsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AdminCreditsContent />
    </Suspense>
  );
}
