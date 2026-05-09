import Logout from "@/module/auth/components/logout";
import { requireAuth } from "@/module/auth/utils/auth-utils";
import { Button } from "@/components/retroui/Button";


export default async function Home() {
  await requireAuth();
  return (
<div className="flex flex-col items-center justify-center h-screen bg-[#e4d9c7]">
  <Logout>
    <Button className="bg-[#ff6b6b] hover:bg-[#ff5252] text-black border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 rounded-xl py-6 px-12 text-xl font-black uppercase transition-all">
      Logout
    </Button>
  </Logout>

</div>
  );
}
