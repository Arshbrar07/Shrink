export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const MINT = "E714f3oiK3sA8WGBBpmgx7Vkptz7Xh7H9YNWjpkLpump";
    const BURN_SIGNER = "9XpUpv1yo2n1DWoQoKWr3Wx3RpihbgBku9vvZ39dm4at";

    const HELIUS_URL =
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;

    const cache = caches.default;

    // Creates a JSON response that Cloudflare/browser can cache
    function jsonResponse(data, ttl) {
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttl}`
        }
      });
    }

    // =========================================================
    // LIVE SUPPLY
    // Cache: 60 seconds
    // =========================================================
    if (url.pathname === "/api/supply") {
      const cacheKey = new Request(url.toString(), { method: "GET" });

      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }

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
          return Response.json(
            {
              status: "error",
              error: data.error
            },
            { status: 500 }
          );
        }

        const response = jsonResponse({
          status: "ok",
          mint: MINT,
          supply: data.result.value.uiAmountString,
          rawSupply: data.result.value.amount,
          decimals: data.result.value.decimals
        }, 60);

        ctx.waitUntil(
          cache.put(cacheKey, response.clone())
        );

        return response;

      } catch (error) {
        return Response.json(
          {
            status: "error",
            error: error.message
          },
          { status: 500 }
        );
      }
    }


    // =========================================================
    // LIVE HOLDERS
    // Cache: 15 minutes
    // =========================================================
    if (url.pathname === "/api/holders") {
      const cacheKey = new Request(url.toString(), { method: "GET" });

      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }

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
            return Response.json(
              {
                status: "error",
                error: data.error
              },
              { status: 500 }
            );
          }

          const accounts =
            data.result?.token_accounts || [];

          for (const account of accounts) {
            if (
              Number(account.amount) > 0 &&
              account.owner
            ) {
              holders.add(account.owner);
            }
          }

          if (accounts.length < limit) {
            break;
          }

          page++;

          if (page > 100) {
            throw new Error("Too many holder pages");
          }
        }

        const response = jsonResponse({
          status: "ok",
          mint: MINT,
          holders: holders.size
        }, 900);

        ctx.waitUntil(
          cache.put(cacheKey, response.clone())
        );

        return response;

      } catch (error) {
        return Response.json(
          {
            status: "error",
            error: error.message
          },
          { status: 500 }
        );
      }
    }


    // =========================================================
    // LIVE BURN CYCLES + BURN LOG
    // Cache: 5 minutes
    // =========================================================
    if (url.pathname === "/api/cycles") {
      const cacheKey = new Request(url.toString(), { method: "GET" });

      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const enhancedUrl =
          `https://api-mainnet.helius-rpc.com/v0/addresses/${BURN_SIGNER}/transactions?api-key=${env.HELIUS_API_KEY}`;

        const heliusResponse = await fetch(enhancedUrl);
        const transactions = await heliusResponse.json();

        if (!heliusResponse.ok) {
          return Response.json(
            {
              status: "error",
              error: transactions
            },
            { status: heliusResponse.status }
          );
        }

        let cycles = 0;
        let totalBurned = 0;
        const burns = [];

        for (const tx of transactions) {
          if (tx.transactionError) continue;

          const mintChanges = [];

          for (const account of tx.accountData || []) {
            for (const change of account.tokenBalanceChanges || []) {
              if (change.mint === MINT) {
                mintChanges.push(change);
              }
            }
          }

          const negativeChanges = mintChanges.filter(
            change =>
              Number(change.rawTokenAmount?.tokenAmount || 0) < 0
          );

          const positiveChanges = mintChanges.filter(
            change =>
              Number(change.rawTokenAmount?.tokenAmount || 0) > 0
          );

          if (
            negativeChanges.length > 0 &&
            positiveChanges.length === 0
          ) {
            let burnedThisCycle = 0;

            for (const change of negativeChanges) {
              const rawAmount = Math.abs(
                Number(change.rawTokenAmount.tokenAmount)
              );

              const decimals =
                Number(change.rawTokenAmount.decimals || 0);

              burnedThisCycle +=
                rawAmount / (10 ** decimals);
            }

            cycles++;
            totalBurned += burnedThisCycle;

            burns.push({
              signature: tx.signature,
              amount: burnedThisCycle,
              timestamp: tx.timestamp
            });
          }
        }

        const response = jsonResponse({
          status: "ok",
          mint: MINT,
          burnSigner: BURN_SIGNER,
          cycles,
          totalBurned,
          burns
        }, 300);

        ctx.waitUntil(
          cache.put(cacheKey, response.clone())
        );

        return response;

      } catch (error) {
        return Response.json(
          {
            status: "error",
            error: error.message
          },
          { status: 500 }
        );
      }
    }


    // =========================================================
    // WEBSITE STATIC FILES
    // =========================================================
    return env.ASSETS.fetch(request);
  }
};
