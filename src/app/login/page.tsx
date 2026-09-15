import { Suspense } from "react";
import LoginPage from "@/modules/authentication/LoginPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
      <LoginPage />
    </Suspense>
  );
}
