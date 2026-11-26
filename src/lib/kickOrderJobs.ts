import { after } from "next/server";
import { orderServiceClient } from "./orderLifecycle";
import { processOrderJob } from "./orderQueue";

// Reduce latency in the normal request path. The database and scheduler
// remain responsible for work when this background callback is interrupted.
export function kickOrderJobs(...keys: string[]) {
  after(async () => {
    try {
      const db = orderServiceClient();
      await Promise.all(keys.map((key) => processOrderJob(db, key)));
    } catch {
      console.warn("[order-queue] deferred to scheduler");
    }
  });
}
