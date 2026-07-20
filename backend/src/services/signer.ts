import { ethers } from "ethers";
import { getEnv } from "../config/env.js";
import pino from "pino";

const logger = pino({ name: "signer" });

export class SignerService {
  private wallet: ethers.Wallet;
  private domainSeparator: string | null = null;

  constructor() {
    const env = getEnv();
    this.wallet = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY);
    logger.info({ address: this.wallet.address }, "Signer initialized");
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async signRelease(
    tradeId: number,
    user: string,
    amountUSDT: number,
    userOpId: string,
  ): Promise<string> {
    const domainSeparator = await this.getDomainSeparator();

    const releaseTypesHash = ethers.keccak256(
      ethers.toUtf8Bytes("Release(uint256 tradeId,address user,uint256 amountUSDT,bytes32 userOpId)"),
    );

    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256", "address", "uint256", "bytes32"],
        [releaseTypesHash, tradeId, user, amountUSDT, userOpId],
      ),
    );

    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", domainSeparator, structHash],
      ),
    );

    const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

    logger.info({ tradeId, user, amountUSDT }, "Release signed");

    return signature;
  }

  private async getDomainSeparator(): Promise<string> {
    if (this.domainSeparator) {
      return this.domainSeparator;
    }

    const env = getEnv();
    const nameHash = ethers.keccak256(ethers.toUtf8Bytes("EscrowMaster"));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes("1"));
    const chainId = env.CHAIN_ID;

    this.domainSeparator = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
          ),
          nameHash,
          versionHash,
          chainId,
          env.ESCROW_CONTRACT_ADDRESS,
        ],
      ),
    );

    return this.domainSeparator;
  }
}
