export default async function handler(req, res) {
  // Optional: simple CORS (aman untuk browser)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const upstream = await fetch(
      "https://api.frankfurter.app/latest?base=IDR&symbols=USD",
      { method: "GET", headers: { accept: "application/json" } }
    );

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: "upstream_failed" });
    }

    const data = await upstream.json();
    const rate = Number(data?.rates?.USD || 0); // 1 IDR = ? USD

    if (!rate || Number.isNaN(rate)) {
      return res.status(502).json({ ok: false, error: "invalid_rate" });
    }

    return res.status(200).json({
      ok: true,
      base: "IDR",
      quote: "USD",
      rate,
      date: data?.date || null,
      source: "frankfurter"
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
