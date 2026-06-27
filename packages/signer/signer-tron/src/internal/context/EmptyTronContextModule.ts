import { type TronClearSignContext } from "@api/model/TronClearSignContext";
import {
  type TronContextModule,
  type TronContextModuleInput,
} from "@api/model/TronContextModule";

export class EmptyTronContextModule implements TronContextModule {
  getContexts(_input: TronContextModuleInput): Promise<TronClearSignContext[]> {
    return Promise.resolve([]);
  }
}
