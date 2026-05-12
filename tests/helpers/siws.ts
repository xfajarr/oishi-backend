import * as ed from "@noble/ed25519";
import bs58 from "bs58";
import { buildMessageBytes, type SiwsInput, type SiwsOutputWire } from "../../src/services/siws.js";

export interface TestKeypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string; // base58
}

export async function makeKeypair(): Promise<TestKeypair> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey, address: bs58.encode(publicKey) };
}

/** Sign a SIWS input with the given private key and return the wire-shaped output. */
export async function signSiws(
  input: SiwsInput,
  kp: TestKeypair,
): Promise<SiwsOutputWire> {
  const signedMessage = buildMessageBytes(input);
  const signature = await ed.signAsync(signedMessage, kp.privateKey);
  return {
    account: { publicKey: kp.address },
    signedMessage: Buffer.from(signedMessage).toString("base64"),
    signature: Buffer.from(signature).toString("base64"),
  };
}

/** Flip a byte in the signature to produce a tampered output. */
export function tamperSignature(out: SiwsOutputWire): SiwsOutputWire {
  const sig = Buffer.from(out.signature, "base64");
  sig[0] ^= 0xff;
  return { ...out, signature: sig.toString("base64") };
}
