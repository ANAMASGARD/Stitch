import { Suspense } from "react";
import LoginUI from "@/module/auth/components/login-ui";
import { requireUnAuth } from "@/module/auth/utils/auth-utils";
import { Loader } from "@/components/retroui/Loader";

/**
 * With `cacheComponents`, `headers()` / session used in `requireUnAuth` must run
 * inside `<Suspense>` so the route can prerender a shell and stream the dynamic part.
 */
function LoginLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#e4d9c7] p-4 font-sans text-black"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader size="lg" />
    </div>
  );
}

async function LoginWithSessionGate() {
  await requireUnAuth();
  return (
    <div>
      <LoginUI />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginWithSessionGate />
    </Suspense>
  );
}
