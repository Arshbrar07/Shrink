export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const MINT = "E714f3oiK3sA8WGBBpmgx7Vkptz7Xh7H9YNWjpkLpump";
    const BURN_SIGNER = "CiZRcErFSYUbg8nnNEz4ktRQn41D63xnLB1xYjE8i8Z1";

    const HELIUS_URL =
      `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;

    // =========================================================
    // LIVE SUPPLY
    // =========================================================
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
          return Response.json(
            {
              status: "error",
              error: data.error
            },
            { status: 500 }
          );
        }

        return Response.json({
          status: "ok",
          mint: MINT,
          supply: data.result.value.uiAmountString,
          rawSupply: data.result.value.amount,
          decimals: data.result.value.decimals
        });

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
    // =========================================================
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

        return Response.json({
          status: "ok",
          mint: MINT,
          holders: holders.size
        });

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
    // TEST BURN TRANSACTION
    // =========================================================
    if (url.pathname === "/api/test-burn") {
      const TEST_SIGNATURE =
        "2sEk3aFn9kZ4boyCYgCyDv6Tz9D9Wn8bCspKU69WDtFcHwd6PeM4nAwjgQTG7SDWpn6gsxPSLnQXfbKL85PeyGf6";

      try {
        const rpcResponse = await fetch(HELIUS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "test-burn",
            method: "getTransaction",
            params: [
              TEST_SIGNATURE,
              {
                encoding: "jsonParsed",
                commitment: "finalized",
                maxSupportedTransactionVersion: 0
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

        if (!data.result) {
          return Response.json(
            {
              status: "error",
              error: "Transaction not found"
            },
            { status: 404 }
          );
        }

        return Response.json({
          status: "ok",
          signature: TEST_SIGNATURE,
          transaction: data.result
        });

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
    // BURN HISTORY TEST
    // =========================================================
   if (url.pathname === "/api/cycles") {
  try {
    const enhancedUrl =
      `https://api-mainnet.helius-rpc.com/v0/addresses/${BURN_SIGNER}/transactions?api-key=${env.HELIUS_API_KEY}`;

    const response = await fetch(enhancedUrl);
    const transactions = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          status: "error",
          error: transactions
        },
        { status: response.status }
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
        change => Number(change.rawTokenAmount?.tokenAmount || 0) < 0
      );

      const positiveChanges = mintChanges.filter(
        change => Number(change.rawTokenAmount?.tokenAmount || 0) > 0
      );

      // A burn reduces the token balance without creating
      // a matching positive token balance elsewhere.
      if (negativeChanges.length > 0 && positiveChanges.length === 0) {
        let burnedThisCycle = 0;

        for (const change of negativeChanges) {
          const rawAmount = Math.abs(
            Number(change.rawTokenAmount.tokenAmount)
          );

          const decimals =
            Number(change.rawTokenAmount.decimals || 0);

          burnedThisCycle += rawAmount / (10 ** decimals);
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

    return Response.json({
      status: "ok",
      mint: MINT,
      burnSigner: BURN_SIGNER,
      cycles,
      totalBurned,
      burns
    });

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
