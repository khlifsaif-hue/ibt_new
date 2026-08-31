import { getSmartCareActor } from "../../../lib/auth-server";

type Carrier = { name: string; url: string; code?: string; logoUrl?: string; transport?: string };

const carriers: Array<{ match: RegExp; carrier: Carrier }> = [
  { match: /^1Z[0-9A-Z]{16}$/i, carrier: { name: "UPS", code: "ups", url: "https://www.ups.com/track?tracknum=" } },
  { match: /^(94|92|93|95)\d{18,20}$/, carrier: { name: "USPS", code: "usps", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=" } },
  { match: /^\d{12,15}$/, carrier: { name: "FedEx", code: "fedex", url: "https://www.fedex.com/fedextrack/?trknbr=" } },
  { match: /^\d{10}$/, carrier: { name: "DHL", code: "dhl", url: "https://www.dhl.com/global-en/home/tracking.html?tracking-id=" } },
  { match: /^[A-Z]{2}\d{9}[A-Z]{2}$/i, carrier: { name: "International postal service", transport: "Postal", url: "https://www.17track.net/en?nums=" } },
  { match: /^\d{10,12}$/, carrier: { name: "Aramex", code: "aramex", url: "https://www.aramex.com/track/results?ShipmentNumber=" } },
  { match: /^(?:JD|GE)\d{12,18}$/i, carrier: { name: "International courier", url: "https://www.17track.net/en?nums=" } },
];

function normalize(value: unknown) { return String(value || "").replace(/\s+/g, "").toUpperCase(); }
function detectCarrier(number: string): Carrier { return carriers.find(item => item.match.test(number))?.carrier || { name: "Carrier not detected", url: "https://www.17track.net/en?nums=" }; }

export async function POST(request: Request) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const number = normalize(body.number);
  if (number.length < 4) return Response.json({ error: "Enter a valid tracking number" }, { status: 400 });
  const detected = detectCarrier(number);
  const tracking = { number, carrier: detected.name, transport: detected.transport || "Courier / postal", logoUrl: detected.logoUrl || "", status: "Tracking number recognized", detail: "Live status is not available for this carrier yet.", checkpoint: "", trackingUrl: `${detected.url}${encodeURIComponent(number)}`, live: false };
  const token = process.env.TRACKING_17TRACK_TOKEN || process.env.TRACK17_API_KEY;
  if (!token) return Response.json({ tracking });
  try {
    const headers = { "17token": token, "content-type": "application/json" };
    await fetch("https://api.17track.net/track/v2.1/register", { method: "POST", headers, body: JSON.stringify({ number }) });
    const response = await fetch(`https://api.17track.net/track/v2.1/gettrackinfo?number=${encodeURIComponent(number)}`, { headers, cache: "no-store" });
    const payload = await response.json();
    const track = payload?.data?.track_info;
    if (track) {
      const latest = track.latest_status;
      const event = track.latest_event;
      const provider = track.tracking?.providers?.[0]?.provider;
      tracking.carrier = provider?.name || tracking.carrier;
      tracking.transport = provider?.service_type || provider?.type || tracking.transport;
      tracking.logoUrl = provider?.logo || provider?.logo_url || tracking.logoUrl;
      tracking.status = latest?.status || tracking.status;
      tracking.detail = latest?.sub_status || "Live status returned by 17TRACK.";
      tracking.checkpoint = event?.time ? `${event.location || ""} ${event.description || ""}`.trim() : "";
      tracking.trackingUrl = provider?.url || tracking.trackingUrl;
      tracking.live = true;
    }
  } catch { /* The carrier fallback remains useful when the provider is unavailable. */ }
  return Response.json({ tracking });
}