import { t } from "@cc/core";
import type { ServiceType } from "@cc/core";
import { ChoiceCards } from "./ChoiceCards";
import { SERVICE_DETAIL_FIELDS, type DetailValues, type Side } from "../../data/serviceDetails";

const TITLE: Record<ServiceType, string> = { nanny: "Nanny details", babysitter: "Babysitter details", au_pair: "Au pair details" };
type Props = { side: Side; services: ServiceType[]; values: Record<string, DetailValues | undefined>; onChange: (next: Record<string, DetailValues>) => void };

export function ServiceDetailsStep({ side, services, values, onChange }: Props) {
  const set = (service: ServiceType, key: string, value: DetailValues[string]) => onChange({ ...(values as Record<string, DetailValues>), [service]: { ...(values[service] ?? {}), [key]: value } });
  if (!services.length) return <p className="muted" role="status">{t("onb.service.none", "Choose a care type first.")}</p>;
  return <div className="onb-field-stack">{services.map((service) => <fieldset key={service} className="onb-fieldset" data-testid={`service-${side}-${service}`}>
    <legend><b>{t(`onb.service.${service}`, TITLE[service])}</b></legend>
    {SERVICE_DETAIL_FIELDS[`${side}:${service}`].map((f) => {
      const v = values[service]?.[f.key];
      const id = `sd-${side}-${service}-${f.key}`;
      const label = t(`onb.service.${side}.${service}.${f.key}`, f.label);
      if (f.type === "bool") return <div key={f.key}><span id={id}>{label}</span><ChoiceCards items={[{ value: "yes", label: t("onb.yes", "Yes") }, { value: "no", label: t("onb.no", "No") }]} value={v === true ? ["yes"] : v === false ? ["no"] : []} onChange={(next) => next[0] && set(service, f.key, next[0] === "yes")} /></div>;
      if (f.type === "multi") return <div key={f.key}><span id={id}>{label}</span><ChoiceCards multiple items={(f.options ?? []).map((o) => ({ value: o, label: o }))} value={Array.isArray(v) ? v : []} onChange={(next) => set(service, f.key, next)} /></div>;
      if (f.type === "choice") return <div key={f.key}><span id={id}>{label}</span><ChoiceCards items={(f.options ?? []).map((o) => ({ value: o, label: o.replace(/_/g, " ") }))} value={typeof v === "string" ? [v] : []} onChange={(next) => next[0] && set(service, f.key, next[0])} /></div>;
      if (f.type === "number") return <label key={f.key} htmlFor={id}>{label}<input id={id} className="field" type="number" inputMode="decimal" min={f.min} max={f.max} value={typeof v === "number" ? v : ""} onChange={(e) => e.target.value === "" ? set(service, f.key, "") : set(service, f.key, Number(e.target.value))} /></label>;
      return <label key={f.key} htmlFor={id}>{label}<input id={id} className="field" type="text" maxLength={200} value={typeof v === "string" ? v : ""} onChange={(e) => set(service, f.key, e.target.value)} /></label>;
    })}
  </fieldset>)}</div>;
}
