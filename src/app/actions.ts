"use server";

// import { getLastSuccessVersion } from "@/db/getLastSuccessVersion";
// import { GetMessageProps, getMessage } from "@/db/getMessage";
// import { GetMessagesProps, getMessages } from "@/db/getMessages";
// import { getUserStats, GetUserStatsProps } from "@/db/getUserStats";
import { getAptosClient } from "@/lib/aptos";
import { Message } from "@/lib/type/message";
import { UserStat } from "@/lib/type/user_stats";
import {
  Account,
  AccountAuthenticator,
  Deserializer,
  Ed25519PrivateKey,
  PendingTransactionResponse,
  PrivateKey,
  PrivateKeyVariants,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";

// export const getMessagesOnServer = async ({
//   page,
//   limit,
//   sortedBy,
//   order,
// }: GetMessagesProps): Promise<{
//   messages: Message[];
//   total: number;
// }> => {
//   return getMessages({ page, limit, sortedBy, order });
// };

// export const getMessageOnServer = async ({
//   messageObjAddr,
// }: GetMessageProps): Promise<{
//   message: Message;
// }> => {
//   return getMessage({ messageObjAddr });
// };

export const getLastVersionOnServer = async (): Promise<number> => {
  // 临时实现：返回当前区块高度作为版本号
  try {
    const latestBlockHeight = await getAptosClient().view<[number]>({
      payload: {
        function: "0x1::block::get_current_block_height",
        typeArguments: [],
        functionArguments: [],
      },
    });
    return latestBlockHeight[0];
  } catch (error) {
    console.error("Error getting last version:", error);
    return 0;
  }
};

// export const getUserStatsOnServer = async ({
//   page,
//   limit,
//   sortedBy,
//   order,
// }: GetUserStatsProps): Promise<{
//   userStats: UserStat[];
//   total: number;
// }> => {
//   return getUserStats({ page, limit, sortedBy, order });
// };

type sponsorAndSubmitTxOnServerProps = {
  transactionBytes: number[]; // representing Unit8Array
  senderAuthenticatorBytes: number[]; // representing Unit8Array
};
export const sponsorAndSubmitTxOnServer = async ({
  transactionBytes,
  senderAuthenticatorBytes,
}: sponsorAndSubmitTxOnServerProps) => {
  const transaction = SimpleTransaction.deserialize(
    new Deserializer(new Uint8Array(transactionBytes))
  );
  const senderAuthenticator = AccountAuthenticator.deserialize(
    new Deserializer(new Uint8Array(senderAuthenticatorBytes))
  );

  const sponsor = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(
        process.env.TX_SPONSOR_PRIVATE_KEY!,
        PrivateKeyVariants.Ed25519
      )
    ),
  });

  const feePayerAuthenticator = getAptosClient().transaction.signAsFeePayer({
    signer: sponsor,
    transaction,
  });

  return await getAptosClient()
    .transaction.submit.simple({
      transaction,
      senderAuthenticator,
      feePayerAuthenticator,
    })
    .then((tx: PendingTransactionResponse) =>
      getAptosClient().waitForTransaction({
        transactionHash: tx.hash,
      })
    );
};
