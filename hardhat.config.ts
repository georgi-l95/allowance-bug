import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  defaultNetwork: "relay",
  networks: {
    relay: {
      url: "http://localhost:7546",
      accounts: [],
      chainId: 298,
    },
  },
};

export default config;
