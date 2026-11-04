import { useEffect, useMemo, useState } from "react";
import { BackBar, Button, t, useNav, type ScreenProps } from "@cc/core";
import { DEMO_CHILDREN, DEMO_SPACES, loadCareSpace, loadCareSpaces, loadChildren, type CarePerms, type CareRole, type CareSpace, type ChildProfile } from "../data/children";
import { addShoppingItems, loadShoppingItems, shoppingItemsForSpace, updateShoppingItem, type ShoppingItem } from "../data/shopping";
import { CareEmpty, DemoNotice } from "./care/common";
import "./care/care.css";

type Params = { spaceId?: string; childId?: string; uid?: string; ownerUid?: string; role?: CareRole; perms?: CarePerms; demo?: boolean };
const demoMode = (explicit?: boolean) => explicit === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1");

export default function Shopping({ params }: ScreenProps<Params>) {
  const nav = useNav();
  const demo = demoMode(params.demo);
  const uid = params.uid ?? "";
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [space, setSpace] = useState<CareSpace | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [itemName, setItemName] = useState("");
  const [childId, setChildId] = useState(params.childId ?? "");
  const [buyer, setBuyer] = useState("");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    if (params.spaceId) {
      if (demo) setSpace(DEMO_SPACES[0] ?? null);
      else loadCareSpace(params.spaceId).then((value) => {
        if (!live || !value) return;
        setSpace({ ...value, role: params.role ?? "viewer", perms: params.perms ?? value.perms, ownerUid: params.ownerUid ?? value.ownerUid });
      }).catch(() => { if (live) setError(t("care.shoppingSpaceError", "Could not open this family shopping list.")); });
      return () => { live = false; };
    }
    (demo ? Promise.resolve(DEMO_SPACES) : uid ? loadCareSpaces(uid) : Promise.resolve([])).then((value) => { if (live) setSpaces(value); }).catch(() => { if (live) setError(t("care.shoppingSpaceError", "Could not load family shopping lists.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [params.spaceId, params.ownerUid, params.role, params.perms, demo, uid]);

  useEffect(() => {
    if (!space) return;
    let live = true;
    setLoading(true); setError("");
    if (demo) {
      const sample: ShoppingItem[] = [
        { id: "demo-shop-1", spaceId: space.id, item: "Paper", source: "activity", sourceId: "paper-bridge", childId: "demo-mila", buyer: "demo-parent", due: "", bought: false, reimbursed: false },
        { id: "demo-shop-2", spaceId: space.id, item: "Apple", source: "meal", sourceId: "apple-oat-porridge", childId: "demo-mila", buyer: "", due: "", bought: true, reimbursed: false },
      ];
      setItems(sample); setChildren(DEMO_CHILDREN); setLoading(false); return () => { live = false; };
    }
    Promise.all([loadShoppingItems(space.id), loadChildren(space.id)]).then(([shopping, childList]) => {
      if (!live) return;
      setItems(shoppingItemsForSpace(space.id, shopping)); setChildren(childList);
    }).catch(() => { if (live) setError(t("care.shoppingLoadError", "Could not load this family’s list.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [space, demo]);

  const visible = useMemo(() => space ? shoppingItemsForSpace(space.id, items) : [], [space, items]);

  async function addManualItem() {
    if (!space || !itemName.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const newItem: ShoppingItem = { id: `local-${Date.now()}`, spaceId: space.id, item: itemName.trim(), childId: childId || undefined, source: "manual", buyer: buyer || undefined, due: due || undefined, bought: false, reimbursed: false };
      if (!demo) {
        await addShoppingItems(space.id, [{ item: itemName.trim(), childId: childId || undefined, source: "manual", buyer: buyer || undefined, due: due || undefined }]);
        setItems(await loadShoppingItems(space.id));
      } else setItems((current) => [...current, newItem]);
      setItemName(""); setDue(""); setNotice(t("care.shoppingAdded", "Added to {family}’s list.", { family: space.name }));
    } catch { setError(t("care.shoppingAddError", "Could not add this item.")); }
    finally { setBusy(false); }
  }

  async function updateItem(item: ShoppingItem, patch: Partial<Pick<ShoppingItem, "buyer" | "due" | "bought" | "reimbursed">>) {
    if (!space) return;
    setError("");
    const next = visible.map((current) => current.id === item.id ? { ...current, ...patch } : current);
    setItems(next);
    if (demo || item.id.startsWith("local-")) return;
    try { await updateShoppingItem(space.id, item.id, patch); }
    catch { setError(t("care.shoppingUpdateError", "Could not update this item. The saved value may be different.")); }
  }

  return <div className="app">
    <BackBar title={t("care.shoppingTitle", "Shopping")}
      onBack={nav.back} right={space ? <span className="care-badge">{space.name}</span> : undefined} />
    <div className="scroll"><div className="care-wrap">
      {demo && <DemoNotice />}
      {error && <div className="care-info care-warning" role="alert">{error}</div>}
      {notice && <div className="care-status" role="status">{notice}</div>}
      {!space ? <section className="care-section">
        <h1>{t("care.shoppingTitle", "Shopping")}</h1>
        <p>{t("care.shoppingSeparate", "Each family keeps its own shopping list. Choose one space to continue.")}</p>
        {spaces.map((item) => <button className="care-space-card" key={item.id} onClick={() => setSpace(item)}><span className="care-badge">{item.name.slice(0, 1)}</span><span className="care-card-copy"><b>{item.name}</b><p>{t("care.shoppingOpenSpace", "Open this family list")}</p></span><span aria-hidden="true">›</span></button>)}
        {!loading && !spaces.length && <CareEmpty title={t("care.noShoppingSpaces", "No family lists yet")} detail={t("care.noShoppingSpacesHint", "Shopping items never combine across families.")} />}
      </section> : <>
        <div className="care-info"><b>{t("care.familyList", "{family} family list", { family: space.name })}</b><p>{t("care.shoppingIsolation", "Only items from this family space appear here.")}</p></div>
        <section className="care-card care-section">
          <h2>{t("care.addShoppingItem", "Add an item")}</h2>
          <label className="care-field"><span>{t("care.shoppingItem", "Item")}</span><input value={itemName} onChange={(event) => setItemName(event.target.value)} /></label>
          <label className="care-field"><span>{t("care.forChild", "For child")}</span><select value={childId} onChange={(event) => setChildId(event.target.value)}><option value="">{t("care.allChildren", "Family")}</option>{children.map((child) => <option value={child.id} key={child.id}>{child.name}</option>)}</select></label>
          <label className="care-field"><span>{t("care.whoBuys", "Who buys it?")}</span><select value={buyer} onChange={(event) => setBuyer(event.target.value)}><option value="">{t("care.unassigned", "Not assigned")}</option>{uid && <option value={uid}>{t("care.buyerMe", "Me")}</option>}{space.ownerUid && space.ownerUid !== uid && <option value={space.ownerUid}>{t("care.buyerParent", "Family admin")}</option>}</select></label>
          <label className="care-field"><span>{t("care.dueDate", "Needed by")}</span><input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label>
          <Button onClick={() => void addManualItem()} disabled={!itemName.trim() || busy}>{t("care.addToList", "Add to list")}</Button>
        </section>
        <section className="care-section">
          <h2>{t("care.shoppingItems", "Items")}</h2>
          {loading ? <div className="sk" style={{ height: 120 }} /> : visible.map((item) => <article className="care-card care-section" key={item.id}>
            <div className="care-head"><div><h3 style={{ textDecoration: item.bought ? "line-through" : undefined }}>{item.item}</h3><p>{t("care.shoppingMeta", "{family} · {child} · from {source}", { family: space.name, child: children.find((child) => child.id === item.childId)?.name ?? t("care.allChildren", "Family"), source: t(`care.source.${item.source}`, item.source) })}</p></div><label className="care-check"><input type="checkbox" checked={item.bought} onChange={(event) => void updateItem(item, { bought: event.target.checked })} /><span>{t("care.bought", "Bought")}</span></label></div>
            <label className="care-field"><span>{t("care.whoBuys", "Who buys it?")}</span><select value={item.buyer ?? ""} onChange={(event) => void updateItem(item, { buyer: event.target.value || undefined })}><option value="">{t("care.unassigned", "Not assigned")}</option>{uid && <option value={uid}>{t("care.buyerMe", "Me")}</option>}{space.ownerUid && space.ownerUid !== uid && <option value={space.ownerUid}>{t("care.buyerParent", "Family admin")}</option>}{item.buyer && item.buyer !== uid && item.buyer !== space.ownerUid && <option value={item.buyer}>{item.buyer}</option>}</select></label>
            <label className="care-field"><span>{t("care.dueDate", "Needed by")}</span><input type="date" value={item.due ?? ""} onChange={(event) => void updateItem(item, { due: event.target.value || undefined })} /></label>
            <label className="care-check"><input type="checkbox" checked={item.reimbursed} disabled={!item.bought} onChange={(event) => void updateItem(item, { reimbursed: event.target.checked })} /><span>{t("care.reimbursed", "Reimbursed")}</span></label>
          </article>)}
          {!loading && !visible.length && <CareEmpty title={t("care.emptyShopping", "Nothing to buy yet")} detail={t("care.emptyShoppingHint", "Approved meal ingredients and activity materials will appear here.")} />}
        </section>
      </>}
    </div></div>
  </div>;
}
