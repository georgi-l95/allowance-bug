import { expect } from "chai";
import dotenv from "dotenv";
import {
  AccountCreateTransaction,
  AccountId,
  AccountInfoQuery,
  Client,
  Hbar,
  LocalProvider,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TransferTransaction,
  Wallet as SDKWallet,
} from "@hashgraph/sdk";
import ERC20MockJson from "./ERC20Mock.json";
import { Contract, JsonRpcApiProvider, JsonRpcProvider, Wallet } from "ethers";
import { ethers } from "hardhat";
dotenv.config();

describe("Allowance", async function () {
  async function createHTSToken(wallet: SDKWallet) {
    let transaction = await new TokenCreateTransaction()
      .setTokenName("ffff")
      .setTokenSymbol("F")
      .setDecimals(3)
      .setInitialSupply(100)
      .setTreasuryAccountId(wallet.getAccountId())
      .setAdminKey(wallet.getAccountKey())
      .setFreezeKey(wallet.getAccountKey())
      .setWipeKey(wallet.getAccountKey())
      .setSupplyKey(wallet.getAccountKey())
      .setFreezeDefault(false)
      .freezeWithSigner(wallet);

    transaction = await transaction.signWithSigner(wallet);
    const resp = await transaction.executeWithSigner(wallet);

    const tokenId = (await resp.getReceiptWithSigner(wallet)).tokenId;
    console.log(`Created HTS with tokenId: ${tokenId!.toString()}`);
    return tokenId;
  }

  async function tokenAssociate(
    wallet: SDKWallet,
    accountId: AccountId,
    accountKey: PrivateKey,
    tokenIds: [TokenId] | [string],
    clientOwned: boolean = false
  ) {
    let transaction = await new TokenAssociateTransaction()
      .setAccountId(accountId.toString())
      .setTokenIds(tokenIds)
      .freezeWithSigner(wallet);
    if (!clientOwned) {
      transaction.sign(accountKey);
    }
    await (
      await (await transaction.signWithSigner(wallet)).executeWithSigner(wallet)
    ).getReceiptWithSigner(wallet);

    for (let index = 0; index < tokenIds.length; index++) {
      console.log(
        `Associated account ${accountId.toString()} with token ${tokenIds[
          index
        ].toString()}`
      );
    }
  }

  function initClient() {
    let client;
    const network = process.env.HEDERA_NETWORK || "{}";
    if (process.env.SUPPORTED_ENV!.includes(network.toLowerCase())) {
      client = Client.forName(network);
    } else {
      client = Client.forNetwork(JSON.parse(network));
    }
    return client;
  }

  function initWallet(
    id: string | AccountId,
    key: string | PrivateKey,
    client: Client
  ) {
    return new SDKWallet(id, key, new LocalProvider({ client: client }));
  }

  let tokenAddress: string;
  let token: any;
  let ownerWallet: Wallet;
  let spender: Wallet;
  let to: Wallet;

  this.beforeAll(async () => {
    const owner = AccountId.fromString("0.0.1013");
    const ownerPriverKey = PrivateKey.fromStringECDSA(
      "0x2e1d968b041d84dd120a5860cee60cd83f9374ef527ca86996317ada3d0d03e7"
    );
    const wallet = initWallet(owner, ownerPriverKey, initClient());

    ownerWallet = new Wallet(
      "0x2e1d968b041d84dd120a5860cee60cd83f9374ef527ca86996317ada3d0d03e7",
      ethers.provider
    );

    const tokenId = await createHTSToken(wallet);

    await tokenAssociate(
      wallet,
      AccountId.fromString("0.0.1014"),
      PrivateKey.fromStringECDSA(
        "0x45a5a7108a18dd5013cf2d5857a28144beadc9c70b3bdbd914e38df4e804b8d8"
      ),
      [tokenId!]
    );
    await tokenAssociate(
      wallet,
      AccountId.fromString("0.0.1015"),
      PrivateKey.fromStringECDSA(
        "0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd"
      ),
      [tokenId!]
    );

    spender = new Wallet(
      "0x45a5a7108a18dd5013cf2d5857a28144beadc9c70b3bdbd914e38df4e804b8d8",
      ethers.provider
    );
    to = new Wallet(
      "0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd",
      ethers.provider
    );
    tokenAddress = "0x" + tokenId?.toSolidityAddress()!;
    console.log(tokenAddress);
    token = new Contract(tokenAddress, ERC20MockJson.abi, ownerWallet);
  });

  it("should approve 100 tokens and check allowance", async function () {
    const approveTx = await token.approve(spender.address, 100);
    const receipt = await approveTx.wait();
    const allowance = await token.allowance(
      ownerWallet.address,
      spender.address
    );

    expect(receipt.status).to.eq(1);
    expect(allowance).to.eq(100);
  });

  it("should tranferFrom owner via spender", async function () {
    const balanceToBefore = await token.balanceOf(to.address);
    const balanceOwnerBefore = await token.balanceOf(ownerWallet.address);
    const transferTx = await token
      .connect(spender)
      .transferFrom(ownerWallet.address, to.address, 100);
    await transferTx.wait();
    const balanceToAfter = await token.balanceOf(to.address);
    const balanceOwnerAfter = await token.balanceOf(ownerWallet.address);

    expect(balanceOwnerBefore).to.equal(100);
    expect(balanceOwnerAfter).to.equal(0);
    expect(balanceToBefore).to.equal(0);
    expect(balanceToAfter).to.equal(100);
  });

  it("should check allowance after transferFrom", async function () {
    const allowance = await token.allowance(
      ownerWallet.address,
      spender.address
    );
    expect(allowance).to.equal(0);
  });
});
