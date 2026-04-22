// @ts-ignore `.open-next/worker.js` is generated during the build step.
import openNextHandler from './.open-next/worker.js';
import { sanitizeIncomingRequest } from './lib/requestHeaderSanitizer';

const openNextFetch =
  typeof openNextHandler === 'function'
    ? openNextHandler
    : openNextHandler.fetch.bind(openNextHandler);

export default {
  async fetch(request, env, ctx) {
    // Cloudflare's managed location headers can contain UTF-8 city/region names
    // such as "Nürnberg". Normalize those to ASCII before OpenNext/Next clones
    // the request so browser-side submit fetches do not fail on invalid headers.
    return openNextFetch(sanitizeIncomingRequest(request), env, ctx);
  },
};
