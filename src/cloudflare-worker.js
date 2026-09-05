import { DurableObject } from "cloudflare:workers";

const CONTAINER_PORT = 20128;
const STARTUP_RETRIES = 40;
const STARTUP_DELAY_MS = 250;

export class OmniRouteContainer extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.container.setInactivityTimeout(30 * 60 * 1000);
  }

  async fetch(request) {
    const container = this.ctx.container;

    if (!container.running) {
      container.start({ enableInternet: true });
    }

    let lastError;
    const port = container.getTcpPort(CONTAINER_PORT);

    for (let attempt = 0; attempt < STARTUP_RETRIES; attempt += 1) {
      try {
        return await port.fetch(request);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY_MS));
      }
    }

    console.error("OmniRoute container did not become ready", lastError);
    return new Response("OmniRoute container is starting. Please retry shortly.", {
      status: 503,
      headers: { "Retry-After": "5" },
    });
  }
}

export default {
  async fetch(request, env) {
    const container = env.OMNIROUTE_CONTAINER.getByName("default");
    return container.fetch(request);
  },
};
