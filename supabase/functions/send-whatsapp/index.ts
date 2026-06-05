import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

interface SendMessageRequest {
  apiToken: string;
  phoneNumberId: string;
  to: string;
  message: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { apiToken, phoneNumberId, to, message } = await req.json() as SendMessageRequest;

    if (!apiToken || !phoneNumberId || !to || !message) {
      return new Response(
        JSON.stringify({ error: "apiToken, phoneNumberId, to e message são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number — ensure it has country code
    let phone = to.replace(/\D/g, "");
    if (!phone.startsWith("55") && phone.length <= 11) {
      phone = "55" + phone;
    }

    const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        type: "text",
        to: phone,
        text: {
          preview_url: false,
          body: message,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(
        JSON.stringify({ error: "Falha ao enviar WhatsApp", details: errBody }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    return new Response(
      JSON.stringify({ success: true, messageId: data.messages?.[0]?.id || null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
