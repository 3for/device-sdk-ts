export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
};

export type GetAddressCommandResponse = {
  readonly publicKey: string;
  /** 34-character Base58Check Tron address ("T..."). */
  readonly address: string;
  readonly chainCode?: string;
};
