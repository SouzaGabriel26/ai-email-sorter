import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // Placeholder for future async unsubscribe job processing
  // For now, all logic is handled in the server action
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
