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
  type SignTypedDataDAError,
  type SignTypedDataDAInput,
  type SignTypedDataDAIntermediateValue,
  type SignTypedDataDAInternalState,
  type SignTypedDataDAOutput,
  SignTypedDataDAStep,
} from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { APP_NAME } from "@internal/app-binder/constants";
import { SignTypedDataTask } from "@internal/app-binder/task/SignTypedDataTask";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

type MachineDependencies = {
  readonly signTypedData: (args: {
    readonly input: {
      readonly derivationPath: string;
      readonly data: TypedData;
      readonly parser: TypedDataParserService;
    };
  }) => Promise<CommandResult<Signature, TronErrorCodes>>;
};

export class SignTypedDataDeviceAction extends XStateDeviceAction<
  SignTypedDataDAOutput,
  SignTypedDataDAInput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue,
  SignTypedDataDAInternalState
> {
  makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    SignTypedDataDAOutput,
    SignTypedDataDAInput,
    SignTypedDataDAError,
    SignTypedDataDAIntermediateValue,
    SignTypedDataDAInternalState
  > {
    type types = StateMachineTypes<
      SignTypedDataDAOutput,
      SignTypedDataDAInput,
      SignTypedDataDAError,
      SignTypedDataDAIntermediateValue,
      SignTypedDataDAInternalState
    >;

    const { signTypedData } = this.extractDependencies(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        signTypedData: fromPromise(signTypedData),
        openAppStateMachine: new OpenAppDeviceAction({
          input: { appName: APP_NAME },
        }).makeStateMachine(internalApi),
      },
      guards: {
        skipOpenApp: () => this.input.skipOpenApp === true,
        noInternalError: ({ context }) => context._internalState.error === null,
      },
      actions: {
        assignSignTypedDataResult: assign({
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
          _internalState: ({ context, event }) => ({
            ...context._internalState,
            error: event["error"] as SignTypedDataDAError,
          }),
        }),
      },
    }).createMachine({
      id: "TronSignTypedDataDeviceAction",
      initial: "InitialState",
      context: ({ input }) => ({
        input,
        intermediateValue: {
          requiredUserInteraction: UserInteractionRequired.None,
          step: SignTypedDataDAStep.OPEN_APP,
        },
        _internalState: {
          error: null,
          signature: null,
        },
      }),
      states: {
        InitialState: {
          always: [
            {
              target: "SignTypedData",
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
                  step: SignTypedDataDAStep.OPEN_APP,
                }),
              }),
            },
            onDone: {
              actions: assign({
                _internalState: ({ context, event }) =>
                  event.output.caseOf<SignTypedDataDAInternalState>({
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
              target: "SignTypedData",
              guard: "noInternalError",
            },
            "Error",
          ],
        },
        SignTypedData: {
          entry: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.SignTypedData,
              step: SignTypedDataDAStep.SIGN_TYPED_DATA,
            },
          }),
          exit: assign({
            intermediateValue: {
              requiredUserInteraction: UserInteractionRequired.None,
              step: SignTypedDataDAStep.SIGN_TYPED_DATA,
            },
          }),
          invoke: {
            id: "signTypedData",
            src: "signTypedData",
            input: ({ context }) => ({
              derivationPath: context.input.derivationPath,
              data: context.input.data,
              parser: context.input.parser,
            }),
            onDone: {
              target: "SignTypedDataResultCheck",
              actions: "assignSignTypedDataResult",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        SignTypedDataResultCheck: {
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
      signTypedData: ({ input }) =>
        new SignTypedDataTask(internalApi, {
          derivationPath: input.derivationPath,
          data: input.data,
          parser: input.parser,
        }).run(),
    };
  }
}
