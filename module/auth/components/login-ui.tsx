"use client"
import { useState } from "react"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/retroui/Button"
import { Input } from "@/components/retroui/Input"
import { Label } from "@/components/retroui/Label"
import { Card } from "@/components/retroui/Card"
import Image from "next/image"

const Github = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/>
  </svg>
)

const LoginUI = () => {
    const [isLoading, setIsLoading] = useState(false);

    const handleGithubLogin = async () => {
        setIsLoading(true);
        try {
            await signIn.social({
                provider: "github",
            });
        } catch (error) {
            console.error("Login failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e4d9c7] text-black p-4 md:p-8 font-sans">
      <Card className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white text-black overflow-hidden border-4 border-black shadow-[8px_8px_0_0_#000] p-0 rounded-2xl h-auto">
        {/* Left Side: Form */}
        <div className="p-6 md:p-8 flex flex-col justify-center bg-[#f7d6a7] text-black">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-black text-black mb-2 font-head uppercase tracking-tight">Stitch</h1>
            <p className="text-black/80 font-bold border-b-2 border-black inline-block pb-1 text-sm md:text-base">Authenticate to connect your repositories.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="font-bold text-sm md:text-base text-black uppercase">Username</Label>
              <Input className="border-4 border-black shadow-[4px_4px_0_0_#000] rounded-xl text-black bg-white py-4 md:py-6 text-base placeholder:text-black/50" placeholder="Enter Your Name" />
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-sm md:text-base text-black uppercase">Workspace URL</Label>
              <Input className="border-4 border-black shadow-[4px_4px_0_0_#000] rounded-xl text-black bg-white py-4 md:py-6 text-base placeholder:text-black/50" placeholder="github.com/your-org" />
            </div>

            <Button
              className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-4 md:py-6 text-lg md:text-xl font-black uppercase mt-2 transition-all"
              onClick={() => {}}
            >
              Sign Up
            </Button>

            <div className="relative my-4 md:my-6 text-center border-t-4 border-black flex justify-center text-sm">
              <span className="bg-[#f7d6a7] px-4 mt-[-14px] font-bold text-base border-x-4 border-black pb-[2px] rounded-full">OR</span>
            </div>

            <Button
              className="w-full bg-[#ffdb33] hover:bg-[#f5cd1a] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-4 md:py-6 text-lg md:text-xl font-black uppercase flex items-center justify-center gap-3 transition-all"
              onClick={handleGithubLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="animate-spin text-2xl">⏳</span>
              ) : (
                <Github size={28} className="stroke-3" />
              )}
              {isLoading ? "Connecting..." : "Continue with GitHub"}
            </Button>
          </div>
        </div>

        {/* Right Side: Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center border-t-4 md:border-t-0 md:border-l-4 border-black relative overflow-hidden min-h-[300px] md:min-h-0 bg-[#fdfaf2]">
          {/* Replaced CSS art with user provided SVG image */}
          <Image
            src="/LOGIN-SCREEN-MASCOT.svg"
            alt="Stitch Mascot"
            fill
            className="w-full h-full object-cover object-center"
          />
        </div>
      </Card>
    </div>
  )
}

export default LoginUI
