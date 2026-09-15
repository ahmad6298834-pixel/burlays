import { Suspense } from "react";
import PrintOrderPage from "@/modules/restaurant/PrintOrderPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading slips...</div>}>
      <PrintOrderPage params={params} />
    </Suspense>
  );
}
