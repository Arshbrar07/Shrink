export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/supply") {
      const MINT = "E714f3oiK3sA8WGBBpmgx7Vkptz7Xh7H9YNWjpkLpump";

      try {
        const rpcResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTokenSupply",
            params: [
              MINT,
              {
                commitment: "finalized"
              }
            ]
          })
        });

        const data = await rpcResponse.json();

        if (data.error) {
          return Response.json({
            status: "error",
            error: data.error
          }, { status: 500 });
        }

        return Response.json({
          status: "ok",
          mint: MINT,
          supply: data.result.value.uiAmountString,
          rawSupply: data.result.value.amount,
          decimals: data.result.value.decimals
        });

      } catch (error) {
        return Response.json({
          status: "error",
          error: error.message
        }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
