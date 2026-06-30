export type TronCalldataSignatures = {
  readonly prod?: string;
  readonly test?: string;
};

export type TronCalldataTransactionDescriptor = {
  readonly data: string;
  readonly signatures: TronCalldataSignatures;
};

export type TronCalldataTransactionInfoV1 = {
  readonly descriptor: TronCalldataTransactionDescriptor;
};

export type TronCalldataEnumV1 = Record<
  string,
  Record<string, TronCalldataTransactionDescriptor>
>;

export type TronCalldataFieldV1 = {
  readonly descriptor: string;
};

export type TronCalldataDescriptorV1 = {
  readonly type: "calldata";
  readonly version: "v1";
  readonly transaction_info: TronCalldataTransactionInfoV1;
  readonly enums: TronCalldataEnumV1;
  readonly fields: readonly TronCalldataFieldV1[];
};

export type TronCalldataDto = {
  readonly descriptors_calldata?: Record<
    string,
    Record<string, TronCalldataDescriptorV1>
  >;
};
