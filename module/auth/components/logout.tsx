"use client"
import React from 'react'
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const Logout = ({
    children,
    className,
}:{
    children: React.ReactNode,
    className?: string
}) => {
  const router = useRouter()
  return (
    <div className={className!} onClick={() => {
      signOut()
      router.push('/login')
    }}>
      {children}
    </div>
  )
}

export default Logout
