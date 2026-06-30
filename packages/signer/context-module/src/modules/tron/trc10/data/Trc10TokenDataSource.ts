import { type Either } from "purify-ts";

export type GetTrc10TokenPayloadParams = {
  readonly tokenId: string;
};

export interface Trc10TokenDataSource {
  getTokenPayload(
    params: GetTrc10TokenPayloadParams,
  ): Promise<Either<Error, string>>;
}
