export type Trc20TokenDto = {
  readonly contract_address?: string;
  readonly standard?: string;
  readonly descriptor?: {
    readonly data?: string;
    readonly signatures?: {
      readonly prod?: string;
      readonly test?: string;
    };
  };
  readonly live_signature?: string;
};
