import { redirect } from "next/navigation";

export default function AdminUsuariosRedirectPage() {
  redirect("/admin/jogadores");
}
