import { buildPwaIconResponse } from "@/lib/pwa-icon";

export const dynamic = "force-dynamic";
export const contentType = "image/png";
export const size = {
  width: 180,
  height: 180,
};

export default async function AppleIcon() {
  return buildPwaIconResponse(size.width);
}
