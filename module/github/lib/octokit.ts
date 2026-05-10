/**
 * Octokit without the `octokit` meta-package entry (which pulls `@octokit/app`
 * and breaks under `tsx` + Node 24: ERR_PACKAGE_PATH_NOT_EXPORTED).
 * Same REST + GraphQL + pagination + retry + throttling stack as upstream Octokit.js.
 */
import { Octokit as OctokitCore } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

export const Octokit = OctokitCore.plugin(
  restEndpointMethods,
  paginateRest,
  paginateGraphQL,
  retry,
  throttling,
).defaults({
  userAgent: "stitch.ai",
  throttle: {
    onRateLimit(retryAfter, options, octokit) {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      );
      if (options.request.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit(retryAfter, options, octokit) {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      );
      if (options.request.retryCount === 0) {
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
  },
});
