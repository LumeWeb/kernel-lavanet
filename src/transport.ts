import { grpc } from "@improbable-eng/grpc-web";
import { RpcNetwork } from "@lumeweb/kernel-rpc-client";
import Metadata = grpc.Metadata;

class HyperTransport implements grpc.Transport {
  private options: grpc.TransportOptions;
  private rpc: RpcNetwork;

  constructor(transportOptions: grpc.TransportOptions, rpc: RpcNetwork) {
    this.options = transportOptions;
    this.rpc = rpc;
  }

  cancel(): void {}

  finishSend(): void {}

  async sendMessage(msgBytes: Uint8Array): Promise<void> {
    const req = this.rpc.simpleQuery({
      query: {
        module: "lavanet",
        method: "badge_request",
        data: {
          data: msgBytes,
        },
      },
    });

    const ret = await req.result;
    if (ret.error) {
      this.options.onEnd({ message: ret.error, name: "", stack: "" });
      return;
    }

    if (ret.data) {
      this.options.onHeaders(new grpc.Metadata(), 200);
      ret.data = new Uint8Array(Object.values(ret.data));
      this.options.onChunk(ret.data);
    }

    this.options.onEnd();
  }

  start(metadata: Metadata): void {}
}

export function hyperTransport(rpc: RpcNetwork): grpc.TransportFactory {
  return (opts: grpc.TransportOptions) => {
    return new HyperTransport(opts, rpc);
  };
}
