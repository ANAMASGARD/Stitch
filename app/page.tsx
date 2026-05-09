import { Suspense } from "react";
import { LandingHero } from "@/module/landing/components/landing-hero";
import { HomeHeroWithSession } from "@/module/landing/components/home-hero-with-session";

export default function Home() {
  return (
    <Suspense fallback={<LandingHero session={null} />}>
      <HomeHeroWithSession />
    </Suspense>
  );
}
