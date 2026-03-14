import { redirect } from "next/navigation";

export default function AdminCadastrosRedirectPage() {
  redirect("/admin/usuarios");
}
