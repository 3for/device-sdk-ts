import { type Either } from "purify-ts";

export type GetTrc20TokenPayloadParams = {
  readonly contractAddress: string;
};

export interface Trc20TokenDataSource {
  getTokenPayload(
    params: GetTrc20TokenPayloadParams,
  ): Promise<Either<Error, string>>;
}
