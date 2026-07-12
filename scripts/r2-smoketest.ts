/** One-off: verify R2 credentials by uploading a small object and reading it
 * back via a signed URL. Deletes nothing; writes to a _smoketest/ prefix. */
import "dotenv/config";
import { putObject, signedGetUrl } from "../src/lib/r2";

async function main() {
  const key = "_smoketest/hello.txt";
  const body = new TextEncoder().encode(`kordex r2 ok @ ${process.argv[2] ?? "test"}`);
  await putObject(key, body, "text/plain");
  console.log("PUT ok →", key);

  const url = await signedGetUrl(key, 120);
  const res = await fetch(url);
  const text = await res.text();
  console.log("GET signed URL status:", res.status);
  console.log("GET body:", text);
  console.log(res.ok && text.startsWith("kordex r2 ok") ? "ROUND-TRIP OK" : "ROUND-TRIP FAILED");
}

main().catch((e) => {
  console.error("R2 smoke test failed:", e.message ?? e);
  process.exit(1);
});
