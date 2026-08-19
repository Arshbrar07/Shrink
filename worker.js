export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/supply") {
      return Response.json({
        status: "worker-ready"
      });
    }

    return env.ASSETS.fetch(request);
  }
};
