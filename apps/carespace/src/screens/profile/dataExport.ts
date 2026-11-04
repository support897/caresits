import { app } from "@cc/core";
import { getFunctions, httpsCallable } from "firebase/functions";

type ExportResponse = { requestId?: string; status?: string };

/** The server owns export assembly; the client sends only the signed-in request. */
export async function requestMyDataExport(): Promise<ExportResponse> {
  const exportMyData = httpsCallable<Record<string, never>, ExportResponse>(getFunctions(app), "exportMyData");
  const result = await exportMyData({});
  return result.data;
}
