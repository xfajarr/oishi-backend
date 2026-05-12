import { Connection, PublicKey } from "@solana/web3.js";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TREASURY = process.env.TREASURY_WALLET ?? "BmdYGSjmPg7oFCjpxf88pRjeu4yMi6bhnVWYsH3W2o6A";
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export interface PaymentVerification {
  valid: boolean;
  amount: number;
  sender: string;
  signature: string;
}

export async function verifyAgentPayment(
  signature: string,
  expectedAmount: number,
  senderWallet: string,
): Promise<PaymentVerification> {
  try {
    const connection = new Connection(RPC, "confirmed");
    const tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return { valid: false, amount: 0, sender: "", signature };

    let transferredAmount = 0;
    let foundSender = "";

    // Parse all instructions to find USDC transfer to treasury
    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        const mint = info.mint;
        const destination = info.destination;
        const amount = Number(info.tokenAmount) || 0;

        if (mint === USDC_MINT.toBase58() && destination === TREASURY) {
          transferredAmount += amount;
          foundSender = info.authority || info.owner || "";
        }
      }
    }

    const valid = transferredAmount >= expectedAmount && foundSender === senderWallet;

    return { valid, amount: transferredAmount, sender: foundSender, signature };
  } catch (err) {
    console.error("Payment verification error:", err);
    return { valid: false, amount: 0, sender: "", signature };
  }
}
