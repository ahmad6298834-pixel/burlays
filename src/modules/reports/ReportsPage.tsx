"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import RiderReportsPage from "./RiderReportsPage";
import RestaurantReportsPage from "./RestaurantReportsPage";

type Tab = "restaurant" | "rider";

/**
 * Reports shell. The existing Daily Rider Report is preserved unchanged as its own
 * tab; the restaurant reports are added alongside it rather than replacing it.
 */
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("restaurant");

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Restaurant sales and rider delivery reporting"
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {([
          { key: "restaurant", label: "Restaurant Sales" },
          { key: "rider", label: "Daily Rider Report" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "restaurant" ? <RestaurantReportsPage /> : <RiderReportsPage />}
    </div>
  );
}
