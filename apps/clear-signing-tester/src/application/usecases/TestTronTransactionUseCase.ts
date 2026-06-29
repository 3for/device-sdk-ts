import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DeviceRepository } from "@root/src/domain/repositories/DeviceRepository";
import { type TestResult } from "@root/src/domain/types/TestStatus";
import { ResultFormatter } from "@root/src/domain/utils/ResultFormatter";

export type TronTransactionTestConfig = {
  readonly derivationPath: string;
};

export type TronTransactionTestResult = {
  readonly title: string;
  readonly data: {
    Description: string;
    Status: string;
    Timestamp: string;
    Error?: string;
  };
  readonly exitCode: number;
};

@injectable()
export class TestTronTransactionUseCase {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.DeviceRepository)
    private readonly deviceRepository: DeviceRepository,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("test-tron-transaction");
  }

  async execute(
    transaction: TransactionInput,
    config: TronTransactionTestConfig,
  ): Promise<TronTransactionTestResult> {
    this.logger.debug("Executing Tron transaction test", {
      data: { description: transaction.description },
    });

    const result = await this.deviceRepository.performSign(
      transaction,
      config.derivationPath,
    );

    return this.formatResult(result);
  }

  private formatResult(result: TestResult): TronTransactionTestResult {
    const statusEmoji = ResultFormatter.getStatusEmoji(result.status);
    const data: {
      Description: string;
      Status: string;
      Timestamp: string;
      Error?: string;
    } = {
      Description: result.input.description || "No description",
      Status: `${statusEmoji} ${result.status.replace(/_/g, " ")}`,
      Timestamp: result.timestamp,
    };

    if (result.errorMessage) {
      data.Error = result.errorMessage;
    }

    return {
      title: "📋 TRON TRANSACTION TEST RESULT",
      data,
      exitCode: result.status === "clear_signed" ? 0 : 1,
    };
  }
}
