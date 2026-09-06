import { redirect } from "next/navigation";

import { hasAdminSession } from "@/blocks/auth/guard";
import { ADMIN_HOME_PATH } from "@/blocks/auth/routes";
import { LoginScreen } from "@/blocks/auth/ui/LoginScreen";

// Единственный адрес под /admin, который отдаётся без сессии, поэтому и лежит вне
// каталога src/app/admin/ — там всё закрыто охраной в layout.tsx.
export default async function AdminLoginPage() {
  if (await hasAdminSession()) {
    redirect(ADMIN_HOME_PATH);
  }

  return <LoginScreen />;
}
