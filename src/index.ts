import { LavaSDK } from "@lavanet/lava-sdk";
import type { ActiveQuery } from "@lumeweb/libkernel/module";
import {
  addHandler,
  defer,
  getKey,
  handlePresentKey as handlePresentKeyModule,
} from "@lumeweb/libkernel/module";
import {
  createClient as createRpcClient,
  RpcNetwork,
} from "@lumeweb/kernel-rpc-client";
import { bytesToHex, deriveChildKey } from "@lumeweb/libweb";
import { hyperTransport } from "./transport.js";

addHandler("presentKey", handlePresentKey);
addHandler("query", handleQuery);

const chainInstances = new Map<string, LavaSDK>();
const moduleReadyDefer = defer();
let rpc: RpcNetwork;

async function handlePresentKey(aq: ActiveQuery) {
  handlePresentKeyModule({
    callerInput: {
      key: aq.callerInput.rootKey,
    },
  } as ActiveQuery);
  rpc = createRpcClient();
  moduleReadyDefer.resolve();
}

async function handleQuery(aq: ActiveQuery) {
  if (!("chain" in aq.callerInput)) {
    aq.reject("chain missing");
    return;
  }
  if (!("query" in aq.callerInput)) {
    aq.reject("query missing");
    return;
  }

  let { chain, query, rpcInterface = undefined } = aq.callerInput;

  chain = chain.toUpperCase();

  let lava: LavaSDK;

  if (!chainInstances.has(chain)) {
    lava = await setupRelayChain(chain, rpcInterface);
  } else {
    lava = chainInstances.get(chain) as LavaSDK;
  }

  await rpc.ready;

  try {
    aq.respond(await lava.sendRelay(query));
  } catch (e) {
    aq.reject(e);
  }
}

async function setupRelayChain(chain: string, rpcInterface?: string) {
  const instance = await LavaSDK.create({
    chainID: chain,
    privateKey: bytesToHex(deriveChildKey(await getKey(), "lavanet")),
    badge: {
      // @ts-ignore
      transport: hyperTransport(rpc),
    },
    rpcInterface,
  });

  chainInstances.set(chain, instance);

  return instance;
}
