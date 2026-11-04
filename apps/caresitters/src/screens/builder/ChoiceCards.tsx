import { t } from "@cc/core";

export type Choice = { value: string; label: string; detail?: string };
export function ChoiceCards({ items, value, onChange, multiple = false }: { items: Choice[]; value: string[]; onChange: (next: string[]) => void; multiple?: boolean }) {
  function toggle(item: string) {
    if (multiple) onChange(value.includes(item) ? value.filter((current) => current !== item) : [...value, item]);
    else onChange(value.includes(item) ? [] : [item]);
  }
  return <div className="onb-choice-grid">{items.map((item) => {
    const selected = value.includes(item.value);
    return <button key={item.value} type="button" className={`onb-choice${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => toggle(item.value)}>
      <span className="onb-choice-mark" aria-hidden="true">{selected ? "✓" : "＋"}</span>
      <span><b>{t(`onb.choice.${item.value}`, item.label)}</b>{item.detail && <small>{item.detail}</small>}</span>
    </button>;
  })}</div>;
}
