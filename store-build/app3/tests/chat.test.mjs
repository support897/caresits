// USAGE: run with node --test tests/chat.test.mjs from store-build/app3.
import assert from "node:assert/strict";
import test from "node:test";
import {
  filterChatsByTab,
  getUnreadCount,
  mergeMessageStreams,
  messageCollectionPath,
  timeMs,
} from "../src/chat-data.js";

const relationships = [
  { id: "family_carer-1", familyUid: "family", carerUid: "carer-1", members: ["family", "carer-1"], state: "contact" },
  { id: "family_carer-2", familyUid: "family", carerUid: "carer-2", members: ["family", "carer-2"], state: "hired" },
  { id: "family_carer-3", familyUid: "family", carerUid: "carer-3", members: ["family", "carer-3"], state: "pending", createdBy: "carer-3" },
  { id: "family_carer-4", familyUid: "family", carerUid: "carer-4", members: ["family", "carer-4"], state: "ended" },
];

test("merges both senders in timestamp order and removes duplicate ids", () => {
  const own = [
    { id: "m2", from: "me", text: "second", at: new Date("2026-11-01T10:02:00Z") },
    { id: "shared", from: "me", text: "same", at: 10 },
  ];
  const other = [
    { id: "m1", from: "other", text: "first", at: { toMillis: () => 1000 } },
    { id: "shared", from: "me", text: "same", at: 10 },
  ];
  assert.deepEqual(mergeMessageStreams(own, other).map((message) => message.id), ["shared", "m1", "m2"]);
});

test("counts only incoming messages after the local seen time", () => {
  const messages = [
    { from: "other", at: 99 },
    { from: "other", at: 100 },
    { from: "other", at: 101 },
    { from: "me", at: 200 },
  ];
  assert.equal(getUnreadCount(messages, "me", 100), 1);
  assert.equal(getUnreadCount(messages, "me", 101), 0);
});

test("filters active chats, unread chats, and pending requests", () => {
  const me = { uid: "family", side: "family" };
  const duplicateList = [...relationships, relationships[0]];
  assert.deepEqual(filterChatsByTab(duplicateList, "All", me).map((rel) => rel.id), ["family_carer-1", "family_carer-2"]);
  assert.deepEqual(filterChatsByTab(duplicateList, "Unread", me, { "family_carer-2": 1 }).map((rel) => rel.id), ["family_carer-2"]);
  assert.deepEqual(filterChatsByTab(duplicateList, "Requests", me).map((rel) => rel.id), ["family_carer-3"]);
  assert.deepEqual(filterChatsByTab(duplicateList, "Carers", me).map((rel) => rel.id), ["family_carer-1", "family_carer-2"]);
  assert.deepEqual(filterChatsByTab(duplicateList, "Families", me), []);
});

test("a carer sees family chats in the Families filter", () => {
  assert.deepEqual(filterChatsByTab(relationships, "Families", { uid: "carer-1", side: "carer" }).map((rel) => rel.id), ["family_carer-1", "family_carer-2"]);
});

test("uses the pair message path and reads Firestore-like times", () => {
  assert.equal(messageCollectionPath("family_carer-1"), "relationships/family_carer-1/messages");
  assert.equal(timeMs({ toDate: () => new Date(1234) }), 1234);
});
