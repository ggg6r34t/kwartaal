import { describe, expect, it } from "vitest";
import {
  createExecutionContext,
  createMessageBatch,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { strFromU8, unzipSync } from "fflate";
import worker from "../index";
import type { ExportQueueMessage } from "../bindings";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * Definition of Done: "Export-zip contains every receipt object plus
 * machine-readable JSON/CSV of all records." `e2e/tests/receipt-vault-export.spec.ts`
 * already proves a real zip downloads with a plausible size; this test
 * opens it and asserts what's actually inside — every tenant table's own
 * JSON file, and the real uploaded receipt bytes under `receipts/`.
 */
describe("export-zip contents (buildExportZip via the real queue consumer)", () => {
  it("contains a JSON file per record type plus the real receipt file", async () => {
    const org = await signUpAndOnboard("export-zip-owner-a@example.com");

    const receiptBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const uploadRes = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: receiptBytes,
    });
    expect(uploadRes.status).toBe(201);
    const receipt = (await uploadRes.json()) as { id: string };

    const jobRes = await authedRequest(org.cookie, "/export-jobs", {
      method: "POST",
      body: JSON.stringify({ kind: "data" }),
    });
    expect(jobRes.status).toBe(201);
    const job = (await jobRes.json()) as { id: string };

    const message: ExportQueueMessage = {
      kind: "export",
      orgId: org.orgId,
      exportJobId: job.id,
    };
    const ctx = createExecutionContext();
    await worker.queue(
      createMessageBatch<ExportQueueMessage>("kwartaal-exports", [
        { id: "export-zip-test-1", timestamp: new Date(), attempts: 1, body: message },
      ]),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    const statusRes = await authedRequest(org.cookie, "/export-jobs");
    const jobs = (await statusRes.json()) as {
      id: string;
      status: string;
      r2Key: string | null;
    }[];
    const completed = jobs.find((j) => j.id === job.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.r2Key).toBeTruthy();

    const object = await env.RECEIPTS.get(completed!.r2Key!);
    expect(object).not.toBeNull();
    const zipBytes = new Uint8Array(await object!.arrayBuffer());
    const files = unzipSync(zipBytes);
    const names = Object.keys(files);

    for (const expected of [
      "quarters.json",
      "income-lines.json",
      "expense-lines.json",
      "depreciation-schedules.json",
      "hours-entries.json",
      "km-entries.json",
      "pots.json",
      "set-aside-entries.json",
      "voorlopige-aanslagen.json",
      "receipts.json",
    ]) {
      expect(names, `${expected} present in the export zip`).toContain(expected);
    }

    const receiptsJson = JSON.parse(strFromU8(files["receipts.json"]!)) as {
      id: string;
    }[];
    expect(receiptsJson.find((r) => r.id === receipt.id)).toBeTruthy();

    const receiptFileName = names.find((n) => n.startsWith(`receipts/${receipt.id}.`));
    expect(
      receiptFileName,
      "the actual receipt file is embedded, not just its metadata",
    ).toBeTruthy();
    expect(files[receiptFileName!]).toEqual(receiptBytes);
  });
});
