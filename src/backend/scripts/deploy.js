const { ethers } = require("hardhat");

async function main() {
  const ethToWei = (num) => ethers.utils.parseEther(num.toString());
  let royaltyFee = ethToWei(0.01);
  let prices = [ethToWei(1), ethToWei(2), ethToWei(3), ethToWei(4), ethToWei(5), ethToWei(6), ethToWei(7), ethToWei(8)];
  let deploymentFees = ethToWei(prices.length * 0.01);
  const [deployer, artist] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // deploy contracts here:
  const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");  // ContractFactory for our contract is needed for deploying our contract
  const nftMarketplace = await NFTMarketplaceFactory.deploy(
    royaltyFee,
    artist.address,
    prices,
    {value: deploymentFees}
  );  // deploying our contract on the local blockchain created by hardhat

  console.log("Smart Contract Address:", nftMarketplace.address);

  // For each contract, pass the deployed contract and name to this function to save a copy of the contract ABI and address to the front end.
  saveFrontendFiles(nftMarketplace, "MusicNFTMarketplace");
}

function saveFrontendFiles(contract, name) {
  const fs = require("fs");
  const contractsDir = __dirname + "/../../frontend/contractsData";

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    contractsDir + `/${name}-address.json`,
    JSON.stringify({ address: contract.address }, undefined, 2)
  );

  const contractArtifact = artifacts.readArtifactSync(name);

  fs.writeFileSync(
    contractsDir + `/${name}.json`,
    JSON.stringify(contractArtifact, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
