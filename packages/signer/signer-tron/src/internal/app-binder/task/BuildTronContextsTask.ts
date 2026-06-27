import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TronClearSignContext } from "@api/model/TronClearSignContext";
import { type TronContextModule } from "@api/model/TronContextModule";

export type BuildTronContextsTaskArgs = {
  readonly contextModule: TronContextModule;
  readonly derivationPath: string;
  readonly rawData: Uint8Array;
  readonly options: TransactionOptions;
};

export class BuildTronContextsTask {
  constructor(private readonly args: BuildTronContextsTaskArgs) {}

  async run(): Promise<TronClearSignContext[]> {
    if (this.args.options.clearSigningMode === "blind") {
      return [];
    }

    if (this.args.options.contexts !== undefined) {
      return this.args.options.contexts;
    }

    try {
      return await this.args.contextModule.getContexts({
        derivationPath: this.args.derivationPath,
        rawData: this.args.rawData,
      });
    } catch {
      return [];
    }
  }
}
