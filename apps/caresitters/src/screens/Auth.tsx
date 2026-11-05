import { SignIn, APP1, TAGLINE, t, type ScreenProps } from "@cc/core";
type Params = { side?: "family" | "carer" };
export default function Auth({ params }: ScreenProps) {
  const { side = "family" } = params as Params;
  const role = side === "family" ? t("auth.role.family", "family") : t("auth.role.carer", "carer");
  const tagline = t("auth.surface.tagline", "Sign in or create your account.", { brandline: TAGLINE, role });
  return <div className="app auth-screen">
    <style>{`.auth-screen .scroll > p:last-of-type{font-size:17px!important}.auth-screen .scroll>button:nth-of-type(2){background:var(--ink)!important;color:var(--cream)!important}@media(prefers-reduced-motion:reduce){.auth-screen .scroll>div:first-child{transform:none!important;opacity:1!important;transition:none!important}}`}</style>
    <SignIn title={t("auth.title", APP1)} tagline={tagline} />
  </div>;
}
