import { SignIn, APP1, TAGLINE, type ScreenProps } from "@cc/core";
export default function Auth(_: ScreenProps) { return <div className="app"><SignIn title={APP1} tagline={TAGLINE} /></div>; }
