/** Profile info (overview) query factory. Shared by overview today; profile
 *  could adopt it later (Architecture/04). */

import { queryOptions } from "@tanstack/react-query";

import { fetchProfileInfo } from "@/lib/api";

export function profileInfoQuery(username: string) {
  return queryOptions({
    queryKey: ["profile-info", username],
    queryFn: () => fetchProfileInfo(username),
    enabled: username.length > 0,
  });
}
