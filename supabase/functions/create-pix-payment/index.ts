import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const XGATE_BASE_URL = "https://api.xgateglobal.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password, amount, txId, customerName, customerDocument } = await req.json();

    if (!email || !password || !amount) {
      return new Response(
        JSON.stringify({ error: "email, password e amount são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Authenticate with XGate
    const authRes = await fetch(`${XGATE_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      return new Response(
        JSON.stringify({ error: "Falha na autenticação XGate", details: errText }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await authRes.json();
    const token = authData.token || authData.access_token || authData.accessToken;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não retornado pela XGate", authResponse: authData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Create PIX charge
    const pixPayload: Record<string, unknown> = {
      amount: Math.round(amount * 100), // Convert to cents
      paymentMethod: "PIX",
    };

    if (txId) pixPayload.txId = txId;
    if (customerName) pixPayload.customerName = customerName;
    if (customerDocument) pixPayload.customerDocument = customerDocument;

    const pixRes = await fetch(`${XGATE_BASE_URL}/pix/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(pixPayload),
    });

    if (!pixRes.ok) {
      const errText = await pixRes.text();
      return new Response(
        JSON.stringify({ error: "Falha ao criar cobrança PIX", details: errText }),
        { status: pixRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pixData = await pixRes.json();

    return new Response(
      JSON.stringify({
        id: pixData.id || pixData.txId,
        txId: pixData.txId || pixData.id,
        status: pixData.status || "PENDING",
        qrCode: pixData.qrCode || pixData.pixQrCode || pixData.emv,
        qrCodeImage: pixData.qrCodeImage || pixData.pixQrCodeImage || null,
        pixCopyPaste: pixData.pixCopyPaste || pixData.emv || pixData.qrCode || null,
        expiresAt: pixData.expiresAt || pixData.expiration || null,
        amount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
