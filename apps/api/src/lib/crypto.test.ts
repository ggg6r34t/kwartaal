import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./crypto";

describe("sealSecret / openSecret", () => {
  it("round-trips plaintext through a string KEK (hashed to 32 bytes)", async () => {
    const sealed = await sealSecret("sk_test_stripe_webhook_secret", "a dev passphrase");
    expect(sealed.ciphertext).not.toContain("sk_test");
    const plaintext = await openSecret(sealed, "a dev passphrase");
    expect(plaintext).toBe("sk_test_stripe_webhook_secret");
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const a = await sealSecret("same-plaintext", "kek");
    const b = await sealSecret("same-plaintext", "kek");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails to decrypt with the wrong KEK", async () => {
    const sealed = await sealSecret("secret-value", "correct-kek");
    await expect(openSecret(sealed, "wrong-kek")).rejects.toThrow();
  });
});
