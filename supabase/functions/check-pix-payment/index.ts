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
    const { email, password, txId } = await req.json();

    if (!email || !password || !txId) {
      return new Response(
        JSON.stringify({ error: "email, password e txId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Authenticate
    const authRes = await fetch(`${XGATE_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      return new Response(
        JSON.stringify({ error: "Falha na autenticação XGate" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authData = await authRes.json();
    const token = authData.token || authData.access_token || authData.accessToken;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não retornado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Check PIX charge status
    const checkRes = await fetch(`${XGATE_BASE_URL}/pix/charge/${txId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!checkRes.ok) {
      const errText = await checkRes.text();
      return new Response(
        JSON.stringify({ error: "Falha ao consultar cobrança", details: errText }),
        { status: checkRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chargeData = await checkRes.json();

    return new Response(
      JSON.stringify({
        txId: chargeData.txId || chargeData.id,
        status: chargeData.status || "PENDING",
        paidAt: chargeData.paidAt || chargeData.paid_at || null,
        amount: chargeData.amount || null,
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
