import { describe, expect, it } from "vitest";
import { aggregateShopping, shoppingItemsForSpace, type ShoppingItem } from "./shopping";

const items: ShoppingItem[] = [
  { id: "a1", spaceId: "family-a", item: "Apples", source: "meal", childId: "mila", bought: false, reimbursed: false },
  { id: "a2", spaceId: "family-a", item: "Paper", source: "activity", childId: "mila", bought: false, reimbursed: false },
  { id: "b1", spaceId: "family-b", item: "Apples", source: "meal", childId: "leo", bought: false, reimbursed: false },
];

describe("family shopping lists", () => {
  it("combines approved meal and activity items for the selected family", () => {
    const familyA = aggregateShopping("family-a", [items[0]!], [items[1]!]);
    expect(familyA.map((item) => item.item)).toEqual(["Apples", "Paper"]);
    expect(familyA.every((item) => item.spaceId === "family-a")).toBe(true);
  });

  it("never mixes another family into a list", () => {
    expect(shoppingItemsForSpace("family-a", items).map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(aggregateShopping("family-b", [items[0]!], [items[1]!], [items[2]!]).map((item) => item.id)).toEqual(["b1"]);
  });
});
