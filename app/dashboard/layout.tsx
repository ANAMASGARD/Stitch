import React, { Suspense } from 'react'
import { SidebarProvider,SidebarInset , SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { requireAuth } from '@/module/auth/utils/auth-utils'

const DashboardLayoutContent = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  await requireAuth()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 px-4 bg-[#e4d9c7] dark:bg-zinc-950 transition-colors">
          <SidebarTrigger className="w-12 h-12 border-4 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:bg-[#ffdb33] dark:hover:bg-[#ffdb33] dark:hover:text-black hover:shadow-[4px_4px_0_0_#000] dark:hover:shadow-[4px_4px_0_0_#fff] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none dark:active:shadow-none transition-all rounded-xl flex items-center justify-center text-black dark:text-white [&>svg]:w-6 [&>svg]:h-6" />
          <h1 className="text-2xl pt-1 font-black text-black dark:text-white font-head tracking-tight uppercase">Dashboard</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-white dark:bg-zinc-900 transition-colors">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  )
}

export default DashboardLayout 
