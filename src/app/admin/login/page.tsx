import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/adminAuth";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await verifyAdminSession()) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5">
      <div className="flex flex-col items-center text-center">
        <BrandMark size={48} />
        <h1 className="mt-5 text-2xl font-semibold">Admin sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Restricted to organizers of the Cursor Hyderabad Meetup.
        </p>
      </div>
      <div className="mt-8 w-full panel p-6">
        <LoginForm />
      </div>
    </main>
  );
}
