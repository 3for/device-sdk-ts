import { type TronClearSignContext } from "@api/model/TronClearSignContext";

export type TronContextModuleInput = {
  readonly derivationPath: string;
  readonly rawData: Uint8Array;
};

export type TronContextModule = {
  readonly getContexts: (
    input: TronContextModuleInput,
  ) => Promise<TronClearSignContext[]>;
};
