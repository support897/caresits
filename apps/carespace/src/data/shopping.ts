import { collection, deleteField, doc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@cc/core";

export type ShoppingSource = "meal" | "activity" | "manual";
export type ShoppingItem = {
  id: string;
  spaceId: string;
  item: string;
  childId?: string;
  source: ShoppingSource;
  sourceId?: string;
  buyer?: string;
  due?: string;
  bought: boolean;
  reimbursed: boolean;
};
export type NewShoppingItem = Omit<ShoppingItem, "id" | "spaceId" | "bought" | "reimbursed">;

export function shoppingItemsForSpace(spaceId: string, items: readonly ShoppingItem[]): ShoppingItem[] {
  return items.filter((item) => item.spaceId === spaceId);
}

export function aggregateShopping(spaceId: string, mealItems: readonly ShoppingItem[], activityItems: readonly ShoppingItem[], manualItems: readonly ShoppingItem[] = []): ShoppingItem[] {
  return shoppingItemsForSpace(spaceId, [...mealItems, ...activityItems, ...manualItems]);
}

export async function loadShoppingItems(spaceId: string): Promise<ShoppingItem[]> {
  const snapshot = await getDocs(collection(db, "careSpaces", spaceId, "shopping"));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id, spaceId, bought: Boolean(item.data().bought), reimbursed: Boolean(item.data().reimbursed) } as ShoppingItem));
}

export async function addShoppingItems(spaceId: string, items: readonly NewShoppingItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    if (!item.item.trim()) continue;
    const ref = doc(collection(db, "careSpaces", spaceId, "shopping"));
    const data: Record<string, unknown> = { item: item.item.trim(), source: item.source, bought: false, reimbursed: false };
    if (item.childId) data.childId = item.childId;
    if (item.sourceId) data.sourceId = item.sourceId;
    if (item.buyer) data.buyer = item.buyer;
    if (item.due) data.due = item.due;
    batch.set(ref, data);
  }
  await batch.commit();
}

export async function updateShoppingItem(spaceId: string, itemId: string, patch: Partial<Pick<ShoppingItem, "buyer" | "due" | "bought" | "reimbursed">>): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) data[key] = value === undefined ? deleteField() : value;
  await updateDoc(doc(db, "careSpaces", spaceId, "shopping", itemId), data);
}
