import Logout from "@/module/auth/components/logout";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Button } from "@/components/retroui/Button";
import Link from "next/link";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#e4d9c7] p-8 font-sans">
      <div className="text-center max-w-2xl bg-white border-4 border-black shadow-[8px_8px_0_0_#000] p-12 rounded-2xl">
        <h1 className="text-6xl font-black mb-6 font-head uppercase tracking-tight">
          Stitch
        </h1>
        <p className="text-xl font-bold mb-10 border-b-2 border-black inline-block pb-2">
          Your AI-powered GitHub orchestration platform.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          {session ? (
            <>
              <Link href="/dashboard">
                <Button className="w-full sm:w-auto bg-[#ffdb33] hover:bg-[#f5cd1a] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-6 px-10 text-xl font-black uppercase transition-all">
                  Go to Dashboard
                </Button>
              </Link>
              <Logout>
                <Button className="w-full sm:w-auto bg-[#ff6b6b] hover:bg-[#ff5252] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-6 px-10 text-xl font-black uppercase transition-all">
                  Logout
                </Button>
              </Logout>
            </>
          ) : (
            <Link href="/login">
              <Button className="w-full sm:w-auto bg-[#ffdb33] hover:bg-[#f5cd1a] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-6 px-12 text-xl font-black uppercase transition-all">
                Get Started
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
