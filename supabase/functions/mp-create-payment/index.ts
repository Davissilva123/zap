import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const { accessToken, amount, description, payerEmail } = await req.json();

    if (!accessToken || !amount) {
      return new Response(
        JSON.stringify({ error: "accessToken e amount são obrigatórios" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        payment_method_id: "pix",
        description: description || "Pedido ZapMenu",
        payer: { email: payerEmail || "cliente@zapmenu.app" },
      }),
    });

    const data = await res.json();

    if (!res.ok || data.status === "rejected") {
      return new Response(
        JSON.stringify({ error: data.message || "Falha ao criar cobrança no Mercado Pago", details: data }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const txData = data.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        txId: String(data.id),
        qrCode: txData?.qr_code || "",
        qrCodeBase64: txData?.qr_code_base64 || "",
        amount: Number(amount),
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
