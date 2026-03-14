import { redirect } from "next/navigation";

export default function AdminLoginRedirectPage() {
  redirect("/entrar?callbackUrl=%2Fadmin");
}
