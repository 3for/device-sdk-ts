import {
  type CommandResult,
  type DeviceActionStateMachine,
  type InternalApi,
  isSuccessCommandResult,
  OpenAppDeviceAction,
  type StateMachineTypes,
  UnknownDAError,
  UserInteractionRequired,
  XStateDeviceAction,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { assign, fromPromise, setup } from "xstate";

import {
  type SignTransactionDAError,
  type SignTransactionDAInput,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAInternalState,
  type SignTransactionDAOutput,
  SignTransactionDAStep,
} from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import {
  type TronClearSignContext,
  TronClearSignContextType,
  type TronTrc10TokenContext,
} from "@api/model/TronClearSignContext";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { BuildTronContextsTask } from "@internal/app-binder/task/BuildTronContextsTask";
import { SendSignGcsTransactionTask } from "@internal/app-binder/task/SendSignGcsTransactionTask";
import { SendSignTransactionTask } from "@internal/app-binder/task/SendSignTransactionTask";

type MachineDependencies = {
  readonly buildContexts: (args: {
    readonly input: SignTransactionDAInput;
  }) => Promise<TronClearSignContext[]>;
  readonly signTransaction: (args: {
    readonly input: {
      readonly derivationPath: string;
      readonly rawData: Uint8Array;
      readonly contexts?: TronTrc10TokenContext[];
    };
  }) => Promise<CommandResult<Signature, TronErrorCodes>>;
  readonly signGcsTransaction: (args: {
    readonly input: {
      readonly derivationPath: string;
      readonly rawData: Uint8Array;
      readonly contexts?: TronClearSignContext[];
    };
  }) => Promise<CommandResult<Signature, TronErrorCodes>>;
};

function isTrc10TokenContext(
  context: TronClearSignContext,
): context is TronTrc10TokenContext {
  return context.type === TronClearSignContextType.TRC10_TOKEN;
}

function isGcsContext(context: TronClearSignContext): boolean {
  return !isTrc10TokenContext(context);
}

export class SignTransactionDeviceAction extends XStateDeviceAction<
  SignTransactionDAOutput,
  SignTransactionDAInput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue,
  SignTransactionDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTransactionDAOutput,
    SignTransactionDAInput,
    SignTransactionDAError,
    SignTransactionDAIntermediateValue,
    SignTransactionDAInternalState
  > {
    type types = StateMachineTypes<
      SignTransactionDAOutput,
      SignTransactionDAInput,
      SignTransactionDAError,
      SignTransactionDAIntermediateValue,
      SignTransactionDAInternalState
    >;

    const { buildContexts, signTransaction, signGcsTransaction } =
      this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        buildContexts: fromPromise(buildContexts),
        signTransaction: fromPromise(signTransaction),
        signGcsTransaction: fromPromise(signGcsTransaction),
        openAppStateMachine: new OpenAppDeviceAction({
          input: {
            appName: APP_NAME,
          },
        }).makeStateMachine(internalApi),
      },
      guards: {
        skipOpenApp: () => this.input.options.skipOpenApp === true,
        shouldUseGcsWithContexts: ({ context }) =>
          this.input.options.clearSigningMode === "gcs" ||
          (this.input.options.clearSigningMode !== "blind" &&
            context._internalState.contexts.some(isGcsContext)),
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignContextsFromEvent: assign({
          _internalState: ({ context, event }) => {
            const contexts = event["output"] as TronClearSignContext[];

            return {
              ...context._internalState,
              contexts,
            };
          },
        }),
        assignSignTransactionResult: assign({
          _internalState: ({ context, event }) => {
            const result = event["output"] as CommandResult<
              Signature,
              TronErrorCodes
            >;

            if (isSuccessCommandResult(result)) {
              return {
                ...context._internalState,
                signature: result.data,
              };
            }

            return {
              ...context._internalState,
              error: result.error,
            };
          },
        }),
        assignErrorFromEvent: assign({
          _internalState: ({ context, event }) => {
            const error = event["error"] as SignTransactionDAError;

            return {
              ...context._internalState,
              error,
            };
          },
        }),
      },
    }).createMachine({
      id: "TronSignTransactionDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: SignTransactionDAStep.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
          contexts: [],
        },
      }),
      states: {
        InitialState: {
          always: [
            {
              target: "BuildContexts",
              guard: "skipOpenApp",
            },
            "OpenAppDeviceAction",
          ],
        },
        OpenAppDeviceAction: {
          invoke: {
            id: "openAppStateMachine",
            input: {
              appName: APP_NAME,
            },
            src: "openAppStateMachine",
            onSnapshot: {
              actions: assign({
                intermediateValue: ({ event }) => ({
                  requiredUserInteraction:
                    event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                  step: SignTransactionDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: ({ context, event }) =>
                  event.output.caseOf<SignTransactionDAInternalState>({
                    Right: () => context._internalState,
                    Left: (error) => ({
                      ...context._internalState,
                      error,
                    }),
                  }),
              }),
              target: "CheckOpenAppResult",
            },
          },
        },
        CheckOpenAppResult: {
          always: [
            {
              target: "BuildContexts",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        BuildContexts: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.BUILD_CONTEXTS,
            },
          }),
          invoke: {
            id: "buildContexts",
            src: "buildContexts",
            input: ({ context }) => context.input,
            onDone: {
              target: "SignTransactionChoice",
              actions: "assignContextsFromEvent",
            },
            onError: {
              target: "SignTransactionChoice",
            },
          },
        },
        SignTransactionChoice: {
          always: [
            {
              target: "SignGcsTransaction",
              guard: "shouldUseGcsWithContexts",
            },
            "SignTransaction",
          ],
        },
        SignGcsTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_GCS_TRANSACTION,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.SIGN_GCS_TRANSACTION,
            },
          }),
          invoke: {
            id: "signGcsTransaction",
            src: "signGcsTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              rawData: context.input.rawData,
              contexts: context._internalState.contexts.filter(isGcsContext),
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: "assignSignTransactionResult",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransaction: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTransactionDAStep.SIGN_TRANSACTION,
            },
          }),
          invoke: {
            id: "signTransaction",
            src: "signTransaction",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              rawData: context.input.rawData,
              contexts:
                context._internalState.contexts.filter(isTrc10TokenContext),
            }),
            onDone: {
              target: "SignTransactionResultCheck",
              actions: "assignSignTransactionResult",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTransactionResultCheck: {
          always: [
            {
              target: "Success",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: ({ context }) =>
        context._internalState.signature
          ? Right(context._internalState.signature)
          : Left(
              context._internalState.error ??
                new UnknownDAError("No error in final state"),
            ),
    });
  }

  extractDependencies(internalApi: InternalApi): MachineDependencies {
    return {
      buildContexts: ({ input }) =>
        new BuildTronContextsTask({
          contextModule: input.contextModule,
          rawData: input.rawData,
          options: input.options,
        }).run(),
      signTransaction: ({ input }) =>
        new SendSignTransactionTask(internalApi, {
          derivationPath: input.derivationPath,
          rawData: input.rawData,
          contexts: input.contexts,
        }).run(),
      signGcsTransaction: ({ input }) =>
        new SendSignGcsTransactionTask(internalApi, {
          derivationPath: input.derivationPath,
          rawData: input.rawData,
          contexts: input.contexts,
        }).run(),
    };
  }
}
