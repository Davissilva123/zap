import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const { accessToken, txId } = await req.json();

    if (!accessToken || !txId) {
      return new Response(
        JSON.stringify({ status: "pending" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${txId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ status: "pending" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    // MP statuses: pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back
    const status: "pending" | "approved" | "rejected" | "cancelled" =
      data.status === "approved" ? "approved" :
      data.status === "rejected" || data.status === "cancelled" || data.status === "charged_back" ? "rejected" :
      "pending";

    return new Response(
      JSON.stringify({ status }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "pending", error: String(err) }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
