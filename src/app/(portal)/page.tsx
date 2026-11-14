import { redirect } from "next/navigation";

// Redirect-only segment: nothing to render, so skip instant-navigation validation.
export const instant = false;

export default function PortalHome() {
  redirect("/orders");
}
