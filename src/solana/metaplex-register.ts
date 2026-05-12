/**
 * Backend Metaplex Agent Registry integration.
 * Creates Core assets + registers identities using a backend keypair.
 */
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { mplCore, create, createCollection } from "@metaplex-foundation/mpl-core";
import {
  mplAgentIdentity,
  registerIdentityV1,
  findAgentIdentityV1Pda,
  fetchAgentIdentityV1,
} from "@metaplex-foundation/mpl-agent-registry";
import { Keypair } from "@solana/web3.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("metaplex");

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * Initialize Umi with a backend keypair.
 */
function createBackendUmi() {
  // Use a deterministic or env-based keypair for the backend
  const secret = process.env.METAPLEX_AUTHORITY_SECRET;
  let keypair: Keypair;
  if (secret) {
    keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(secret)),
    );
  } else {
    // For dev, generate a new one each time (assets will be lost on restart)
    keypair = Keypair.generate();
    log.warn("No METAPLEX_AUTHORITY_SECRET set — using ephemeral keypair");
  }

  const umiKeypair = keypairIdentity({
    publicKey: publicKey(keypair.publicKey.toBase58()),
    secretKey: keypair.secretKey,
  });

  return createUmi(RPC)
    .use(umiKeypair)
    .use(mplCore())
    .use(mplAgentIdentity());
}

/**
 * Register an agent identity on Metaplex.
 * Creates a Core collection + asset, then registers AgentIdentity plugin.
 */
export async function registerMetaplexIdentity(
  agentName: string,
  agentHandle: string,
): Promise<{ assetPubkey: string; identityPda: string; registrationUri: string }> {
  const umi = createBackendUmi();
  const name = agentHandle.replace("@", "").replace(".oishi", "");

  // Create a collection for Oishi agents
  const collection = generateSigner(umi);
  await createCollection(umi, {
    collection,
    name: "Oishi Agents",
    uri: "https://oishi.app/collection.json",
  }).sendAndConfirm(umi);

  log.info(`Created Metaplex collection: ${collection.publicKey}`);

  // Create the agent's Core asset
  const asset = generateSigner(umi);
  const registrationUri = `data:application/json,${encodeURIComponent(JSON.stringify({
    schema: "metaplex.agent.registration.v0",
    core_asset: asset.publicKey.toString(),
    name: agentName,
    description: `Oishi AI agent: ${agentHandle}`,
    services: [{ name: "web", endpoint: `https://oishi.app/agent/${name}` }],
    capabilities: ["defi", "yield", "trading"],
    active: true,
    registrations: [{ agentId: asset.publicKey.toString(), agentRegistry: "solana:101:metaplex" }],
    supportedTrust: ["reputation"],
  }))}`;

  await create(umi, {
    asset,
    name: agentName,
    uri: registrationUri,
    collection: collection.publicKey as any,
  }).sendAndConfirm(umi);

  log.info(`Created Core asset: ${asset.publicKey}`);

  // Register identity via Agent Registry
  await registerIdentityV1(umi, {
    asset: asset.publicKey,
    collection: collection.publicKey as any,
    agentRegistrationUri: registrationUri,
  }).sendAndConfirm(umi);

  const pda = findAgentIdentityV1Pda(umi, { asset: asset.publicKey });
  await fetchAgentIdentityV1(umi, pda);

  log.info(`Registered Metaplex identity: ${pda}`);

  return {
    assetPubkey: asset.publicKey.toString(),
    identityPda: pda.toString(),
    registrationUri,
  };
}
