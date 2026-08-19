export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const MINT = "E714f3oiK3sA8WGBBpmgx7Vkptz7Xh7H9YNWjpkLpump";
    const HELIUS_URL =
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;

    // LIVE SUPPLY
    if (url.pathname === "/api/supply") {
      try {
        const rpcResponse = await fetch(HELIUS_URL, {
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

    // LIVE HOLDERS
    if (url.pathname === "/api/holders") {
      try {
        const holders = new Set();
        let page = 1;
        const limit = 1000;

        while (true) {
          const rpcResponse = await fetch(HELIUS_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: `holders-${page}`,
              method: "getTokenAccounts",
              params: {
                mint: MINT,
                page,
                limit,
                options: {
                  showZeroBalance: false
                }
              }
            })
          });

          const data = await rpcResponse.json();

          if (data.error) {
            return Response.json({
              status: "error",
              error: data.error
            }, { status: 500 });
          }

          const result = data.result;
          const accounts = result?.token_accounts || [];

          for (const account of accounts) {
            if (Number(account.amount) > 0 && account.owner) {
              holders.add(account.owner);
            }
          }

          if (accounts.length < limit) {
            break;
          }

          page++;

          // Safety limit
          if (page > 100) {
            throw new Error("Too many holder pages");
          }
        }

        return Response.json({
          status: "ok",
          mint: MINT,
          holders: holders.size
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
