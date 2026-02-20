import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    console.log("📩 Incoming webhook body:", body);

    const { type, data } = body;

    // Only handle Clerk's user.created webhook
    if (type === "user.created") {
      const userId = data.id;
      const email = data.email_addresses?.[0]?.email_address ?? "unknown@vetta.ai";
      const firstName = data.first_name ?? "N/A";
      const lastName = data.last_name ?? "N/A";

      const { error } = await supabase
        .from("dealers")
        .insert([
          {
            user_id: userId,
            contact_email: email,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.error("❌ Insert error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }

      console.log("✅ Dealer inserted for user:", userId);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    console.log("ℹ️ Ignored event type:", type);
    return new Response(JSON.stringify({ ignored: true }), { status: 200 });

  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
