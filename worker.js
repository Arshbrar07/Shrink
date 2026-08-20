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


    // LIVE BURN CYCLES
if (url.pathname === "/api/cycles") {
  const BURN_SIGNER = "CiZRcErFSYUbg8nnNEz4ktRQn41D63xnLB1xYjE8i8Z1";

  try {
    // Get transactions involving the bot/burn signer
    const sigResponse = await fetch(HELIUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "cycle-signatures",
        method: "getSignaturesForAddress",
        params: [
          BURN_SIGNER,
          {
            limit: 1000
          }
        ]
      })
    });

    const sigData = await sigResponse.json();

    if (sigData.error) {
      return Response.json({
        status: "error",
        error: sigData.error
      }, { status: 500 });
    }

    const signatures = sigData.result || [];

    let cycles = 0;
    let totalBurned = 0;
    const burns = [];

    // Check each transaction
    for (const sigInfo of signatures) {
      if (sigInfo.err) continue;

      const txResponse = await fetch(HELIUS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: sigInfo.signature,
          method: "getTransaction",
          params: [
            sigInfo.signature,
            {
              encoding: "jsonParsed",
              commitment: "finalized",
              maxSupportedTransactionVersion: 0
            }
          ]
        })
      });

      const txData = await txResponse.json();
      const tx = txData.result;

      if (!tx || tx.meta?.err) continue;

      const instructions =
        tx.transaction?.message?.instructions || [];

      for (const instruction of instructions) {
        const parsed = instruction?.parsed;

        if (
          parsed?.type === "burnChecked" &&
          parsed?.info?.mint === MINT &&
          parsed?.info?.authority === BURN_SIGNER
        ) {
          const amount =
            Number(parsed.info.tokenAmount?.uiAmountString || 0);

          cycles++;
          totalBurned += amount;

          burns.push({
            signature: sigInfo.signature,
            amount,
            blockTime: tx.blockTime
          });

          // Count each transaction only once
          break;
        }
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
    return Response.json({
      status: "error",
      error: error.message
    }, { status: 500 });
  }
}
    
    // TEST BURN TRANSACTION
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
      return Response.json({
        status: "error",
        error: data.error
      }, { status: 500 });
    }

    if (!data.result) {
      return Response.json({
        status: "error",
        error: "Transaction not found"
      }, { status: 404 });
    }

    return Response.json({
      status: "ok",
      signature: TEST_SIGNATURE,
      transaction: data.result
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

    
    // TEST BURN TRANSACTION
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
      return Response.json({
        status: "error",
        error: data.error
      }, { status: 500 });
    }

    if (!data.result) {
      return Response.json({
        status: "error",
        error: "Transaction not found"
      }, { status: 404 });
    }

    return Response.json({
      status: "ok",
      signature: TEST_SIGNATURE,
      transaction: data.result
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
