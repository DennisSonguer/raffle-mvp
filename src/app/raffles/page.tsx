export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import RafflesClient from "./RafflesClient";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RafflesClient />
    </Suspense>
  );
}
