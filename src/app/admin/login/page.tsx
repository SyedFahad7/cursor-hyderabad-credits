import { CursorLogo } from "@/components/CursorLogo";
import { PublicShell } from "@/components/PublicShell";
import { verifyAdminSession } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await verifyAdminSession()) redirect("/admin");
  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col items-center justify-center px-5 py-12 md:max-w-[440px] 2xl:max-w-[480px] 3xl:max-w-[520px]">
        <CursorLogo priority className="mb-8" />

        <div className="flex flex-col items-center text-center">
          <span className="chip">Admin · Restricted</span>
          <h1 className="mt-5 text-fluid-display font-semibold tracking-tight text-ink">
            Admin sign in
          </h1>
          <p className="mt-2 max-w-sm text-fluid-lead text-ink-muted">
            For organizers of the Cursor Hyderabad Meetup only.
          </p>
        </div>

        <div className="mt-8 w-full panel p-6 sm:p-7 2xl:p-8">
          <LoginForm />
        </div>
      </main>
    </PublicShell>
  );
}
