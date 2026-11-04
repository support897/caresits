import type { ReactNode } from "react";
import { Bunny, t } from "@cc/core";
import type { AllergyCheck } from "../../lib/allergy";

export function DemoNotice() {
  return <p className="care-demo" role="note">{t("care.demoNotice", "Sample information only. Do not use for real care decisions.")}</p>;
}

export function AllergyBanner({ names }: { names: string[] }) {
  if (!names.length) return null;
  return <div className="care-alert" role="alert" aria-live="polite">
    <strong>{t("care.allergyBannerTitle", "Allergy alert")}</strong>
    <p>{t("care.allergyBannerText", "This child has recorded allergies: {names}. Check every label and ask the parent before serving food.", { names: names.join(", ") })}</p>
  </div>;
}

export function AllergyCheckNotice({ result }: { result: AllergyCheck }) {
  const title = result.status === "contains"
    ? t("care.allergy.contains", "A listed allergy may match these ingredients.")
    : result.status === "may-contain"
      ? t("care.allergy.cross", "Possible cross-contamination. Ask the parent before serving.")
      : result.status === "unknown-ingredient"
        ? t("care.allergy.unknown", "Unknown ingredient. Check the full label with the parent.")
        : t("care.allergy.nomatch", "No ingredient match was found.");
  return <div className="care-alert" role="alert" aria-live="polite">
    <strong>{title}</strong>
    {result.reasons.filter((reason) => !reason.startsWith("No match found is not a safety guarantee.")).map((reason, index) => <p key={`${index}-${reason}`}>{reason}</p>)}
    {result.crossContamination.map((warning, index) => <p key={`cross-${index}`}>{warning}</p>)}
    <p><b>{t("care.allergy.copy", "No match found is not a safety guarantee. Check labels and ask the parent.")}</b></p>
  </div>;
}

export function CareEmpty({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="care-empty"><Bunny mood="point" size={92} /><h2>{title}</h2>{detail && <p>{detail}</p>}{action}</div>;
}
