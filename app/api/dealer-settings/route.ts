import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/utils/supabaseAdmin";
import { resolveDealerIdFromParam, resolveDealerIdForUser } from "@/lib/resolveDealerId";

/** Defaults */
const DEFAULT_SETTINGS = {
  // branding
  logo_url: null as string | null,
  theme_color: "#1E3A8A",
  contact_email: null as string | null,

  // dealer-fit prefs
  max_pti_ratio: 0.35,
  require_valid_driver_license: true,
  min_down_payment: 1000,
  min_residence_months: 8,
  min_employment_months: 6,
};

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function getAuthedUserId(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { userId: null as string | null, error: "Missing Authorization token" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return { userId: null as string | null, error: "Invalid or expired session token" };

  return { userId: data.user.id, error: null as string | null };
}

async function tryGetDealerNameById(dealerId: string): Promise<string | null> {
  // Your schema shows dealers.name exists, so use that first.
  const { data, error } = await supabaseAdmin.from("dealers").select("name").eq("id", dealerId).maybeSingle();
  if (!error && data?.name) return String(data.name).trim() || null;

  // optional fallbacks if you ever add other tables
  const candidates = [
    { table: "dealerships", col: "name", idCol: "id" },
    { table: "dealerships", col: "business_name", idCol: "id" },
  ];

  for (const c of candidates) {
    const { data: d, error: e } = await supabaseAdmin.from(c.table).select(c.col).eq(c.idCol, dealerId).maybeSingle();
    if (!e && d && typeof (d as any)[c.col] === "string") {
      const v = String((d as any)[c.col] || "").trim();
      if (v) return v;
    }
  }

  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dealerParam = (url.searchParams.get("dealer") || "").trim();

  /**
   * ✅ PUBLIC MODE (customer / QR / link)
   * Allows dealer param to be either:
   * - uuid (dealerId)
   * - slug/key (dealers.name, e.g. "zaydealers")
   */
  if (dealerParam && dealerParam !== "demo") {
    const resolved = await resolveDealerIdFromParam(dealerParam);

    // If dealer not found, still return safe defaults (public)
    if (!resolved.ok) {
      return NextResponse.json(
        { mode: "public", dealer_name: null, dealer_id: null, ...DEFAULT_SETTINGS },
        { status: 200 }
      );
    }

    const dealerId = resolved.dealerId;
    const dealerName = (await tryGetDealerNameById(dealerId)) ?? resolved.dealerKey ?? null;

    const { data, error } = await supabaseAdmin
      .from("dealer_settings")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { mode: "public", dealer_name: dealerName, dealer_id: dealerId, ...DEFAULT_SETTINGS },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        mode: "public",
        dealer_name: dealerName,
        dealer_id: dealerId,

        logo_url: data.logo_url ?? DEFAULT_SETTINGS.logo_url,
        theme_color: data.theme_color ?? DEFAULT_SETTINGS.theme_color,
        contact_email: data.contact_email ?? DEFAULT_SETTINGS.contact_email,

        max_pti_ratio: Number(data.max_pti_ratio ?? DEFAULT_SETTINGS.max_pti_ratio),
        require_valid_driver_license: Boolean(
          data.require_valid_driver_license ?? DEFAULT_SETTINGS.require_valid_driver_license
        ),
        min_down_payment: Number(data.min_down_payment ?? DEFAULT_SETTINGS.min_down_payment),
        min_residence_months: Number(data.min_residence_months ?? DEFAULT_SETTINGS.min_residence_months),
        min_employment_months: Number(data.min_employment_months ?? DEFAULT_SETTINGS.min_employment_months),
      },
      { status: 200 }
    );
  }

  /**
   * ✅ AUTH MODE (dealer dashboard/settings)
   */
  const { userId, error: authErr } = await getAuthedUserId(req);
  if (!userId) {
    // Demo visitors (no auth)
    return NextResponse.json({ mode: "demo", dealer_name: null, dealer_id: null, ...DEFAULT_SETTINGS }, { status: 200 });
  }

  const resolved = await resolveDealerIdForUser(userId);
  if (!resolved.ok) {
    return NextResponse.json(
      { mode: "normal", dealer_name: null, dealer_id: null, ...DEFAULT_SETTINGS, warning: resolved.error },
      { status: 200 }
    );
  }

  const dealerId = resolved.dealerId;
  const dealerName = (await tryGetDealerNameById(dealerId)) ?? resolved.dealerKey ?? null;

  const { data, error } = await supabaseAdmin
    .from("dealer_settings")
    .select("*")
    .eq("dealer_id", dealerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { mode: "normal", dealer_name: dealerName, dealer_id: dealerId, ...DEFAULT_SETTINGS },
      { status: 200 }
    );
  }

  // Auto-create row if missing (auth mode only)
  if (!data) {
    await supabaseAdmin.from("dealer_settings").upsert({
      dealer_id: dealerId,
      ...DEFAULT_SETTINGS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { mode: "normal", dealer_name: dealerName, dealer_id: dealerId, ...DEFAULT_SETTINGS },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      mode: "normal",
      dealer_name: dealerName,
      dealer_id: dealerId,

      logo_url: data.logo_url ?? DEFAULT_SETTINGS.logo_url,
      theme_color: data.theme_color ?? DEFAULT_SETTINGS.theme_color,
      contact_email: data.contact_email ?? DEFAULT_SETTINGS.contact_email,

      max_pti_ratio: Number(data.max_pti_ratio ?? DEFAULT_SETTINGS.max_pti_ratio),
      require_valid_driver_license: Boolean(
        data.require_valid_driver_license ?? DEFAULT_SETTINGS.require_valid_driver_license
      ),
      min_down_payment: Number(data.min_down_payment ?? DEFAULT_SETTINGS.min_down_payment),
      min_residence_months: Number(data.min_residence_months ?? DEFAULT_SETTINGS.min_residence_months),
      min_employment_months: Number(data.min_employment_months ?? DEFAULT_SETTINGS.min_employment_months),
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const { userId, error: authErr } = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: authErr || "Unauthorized" }, { status: 401 });

  const resolved = await resolveDealerIdForUser(userId);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const dealerId = resolved.dealerId;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const updateData = {
    dealer_id: dealerId,

    logo_url: typeof body.logo_url === "string" ? body.logo_url : DEFAULT_SETTINGS.logo_url,
    theme_color: typeof body.theme_color === "string" ? body.theme_color : DEFAULT_SETTINGS.theme_color,
    contact_email: typeof body.contact_email === "string" ? body.contact_email : DEFAULT_SETTINGS.contact_email,

    max_pti_ratio:
      typeof body.max_pti_ratio === "number" && body.max_pti_ratio > 0 && body.max_pti_ratio < 1
        ? body.max_pti_ratio
        : DEFAULT_SETTINGS.max_pti_ratio,

    require_valid_driver_license:
      typeof body.require_valid_driver_license === "boolean"
        ? body.require_valid_driver_license
        : DEFAULT_SETTINGS.require_valid_driver_license,

    min_down_payment:
      typeof body.min_down_payment === "number" && body.min_down_payment >= 0
        ? Math.round(body.min_down_payment)
        : DEFAULT_SETTINGS.min_down_payment,

    min_residence_months:
      typeof body.min_residence_months === "number" && body.min_residence_months >= 0
        ? Math.round(body.min_residence_months)
        : DEFAULT_SETTINGS.min_residence_months,

    min_employment_months:
      typeof body.min_employment_months === "number" && body.min_employment_months >= 0
        ? Math.round(body.min_employment_months)
        : DEFAULT_SETTINGS.min_employment_months,

    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("dealer_settings").upsert(updateData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
