# ETHPOOL

Ethereum mainnet dashboard. A block is a batch of payments. A transaction is one payment split into the money received, the burned network fee, and the tip. An address is a wallet or a program.

| Route               | What it shows                                                                 |
| ------------------- | ----------------------------------------------------------------------------- |
| `/`                 | Next base fee, recent blocks, and how full they are                           |
| `/block/$blockId`   | Gas treemap for one block (`latest` or a block number)                        |
| `/tx/$hash`         | Value, burn, and tip for one transaction                                      |
| `/address/$address` | Balance and recent ether transfers, including ENS names such as `vitalik.eth` |
| `/trace`            | Addresses tracked in this browser                                             |

Data comes from public Ethereum RPC hosts, with RouteScan for transfers and a keyless ENS lookup. No API key or env var is required.

```bash
bun install
bun --bun run dev
bun test
bun run build
```

Dev server: http://localhost:3000. The app refreshes live data every 20 seconds.
