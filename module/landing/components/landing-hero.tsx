"use client";

import Link from "next/link";

interface LandingHeroProps {
  session: unknown;
}

export function LandingHero({ session }: LandingHeroProps) {
  return (
    <div className="relative h-screen w-full overflow-hidden font-body text-white selection:bg-white/20 bg-black">
      {/* Cinematic Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Navigation Bar */}
      <nav className="relative z-10 flex flex-row items-center justify-between px-8 md:px-12 py-8 w-full max-w-[100vw]">
        <div className="flex items-center w-[200px]">
          <span className="text-3xl tracking-tight font-display text-white">
            Stitch
          </span>
        </div>

        {/* Center Nav Links - Absolutely centered */}
        <div className="hidden md:flex gap-8 items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link href="#" className="text-sm font-body text-white transition-colors duration-300">
            Features
          </Link>
          <Link href="#" className="text-sm font-body text-[#a3a3a8] hover:text-white transition-colors duration-300">
            How it Works
          </Link>
          <Link href="#" className="text-sm font-body text-[#a3a3a8] hover:text-white transition-colors duration-300">
            Docs
          </Link>
          <Link href="#" className="text-sm font-body text-[#a3a3a8] hover:text-white transition-colors duration-300">
            Changelog
          </Link>
          <Link href="#" className="text-sm font-body text-[#a3a3a8] hover:text-white transition-colors duration-300">
            Support
          </Link>
        </div>

        <div className="flex justify-end w-[200px]">
          {session ? (
            <Link href="/dashboard" className="liquid-glass rounded-full px-6 py-2 text-sm text-white hover:scale-[1.03] transition-transform duration-300 inline-block font-body">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="liquid-glass rounded-full px-6 py-2 text-sm text-white hover:scale-[1.03] transition-transform duration-300 inline-block font-body">
              Begin Journey
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 h-[calc(100vh-100px)]">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center -mt-16">

          <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] leading-[1.1] tracking-[-1.5px] font-normal font-display text-white animate-fade-rise">
            Where <em className="not-italic text-[#a3a3a8]">code</em> flows <em className="not-italic text-[#a3a3a8]">without the noise.</em>
          </h1>

          <p className="text-[#a3a3a8] text-base sm:text-[17px] max-w-2xl mt-8 font-body font-normal leading-relaxed animate-fade-rise-delay">
            Stitch is your AI-powered GitHub orchestrator. We strip away the clutter so you can focus on what matters most—managing issues, reviewing pull requests, and shipping brilliant work safely.
          </p>

          <div className="mt-14 animate-fade-rise-delay-2">
            {session ? (
              <Link href="/dashboard" className="liquid-glass rounded-full px-10 py-3.5 text-sm text-white hover:scale-[1.03] transition-transform duration-300 cursor-pointer inline-block font-body tracking-wide">
                Go to Dashboard
              </Link>
            ) : (
              <Link href="/login" className="liquid-glass rounded-full px-10 py-3.5 text-sm text-white hover:scale-[1.03] transition-transform duration-300 cursor-pointer inline-block font-body tracking-wide">
                Begin Journey
              </Link>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
