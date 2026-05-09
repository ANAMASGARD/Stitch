import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { LandingHero } from "@/module/landing/components/landing-hero";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return <LandingHero session={session} />;
}
