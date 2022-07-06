// Notes:
// "Waffle" is framework for testing
// "describe" and "it" are functions of "mocha" library
// "expect" is a function of "chai" library

// require() statement basically reads a JavaScript file, executes it, and then proceeds to return the export object
// this line is basically availing the use of "chai.expect()"
const { expect } = require("chai"); 
// we will also be using hardhat.ethers() to interact with our smart contract
const { ethers } = require("hardhat");

// arrow functions for converting from ethers to wei and vice-versa
const ethToWei = (num) => ethers.utils.parseEther(num.toString()); // string => bigNumber
const weiToEth = (num) => ethers.utils.formatEther(num);          // bigNumber => string

// "describe" is a mocha function for grouping tests together
//  takes 2 arguments -> name of the test, callback function (function which is passed as an argument to another function)
describe("Music-NFT Marketplace Testing", function () {

  let nftMarketplace;
  let deployer, artist, user1, user2, users;  // address of all the associated persons
  let royaltyFee = ethToWei(0.01); // the artist will receive 0.01 ether for each reselling
  let URI = "https://bafybeidhjjbjonyqcahuzlpt7sznmh4xrlbspa3gstop5o47l6gsiaffee.ipfs.nftstorage.link/";  // the URI where all the musics are stored
  let prices = [ethToWei(1), ethToWei(2), ethToWei(3), ethToWei(4), ethToWei(5), ethToWei(6), ethToWei(7), ethToWei(8)];  // setting the prices for each of the musics in the marketplace
  let deploymentFees = ethToWei(prices.length * 0.01);  // the deployer will need to pay the royaltyFee for all the musics

  // beforeEach will run this async function before every "it"
  beforeEach(async function () {

    // ContractFactory is needed for the deployment of the smart contract
    const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");

    // GetSigners returns the accounts of all the nodes in the blockchain. 
    // "...users" will contain the list of the accounts of user3 till lastUser // ethers.getSigners is a function of ether.js which is injected into hardhat
    [deployer, artist, user1, user2, ...users] = await ethers.getSigners();  // so we can collect all the signers running on this hardhat local blockchain

    // Deploying the contract passing the arguments which the .sol contract needed in its' constructor
    // the promise from .deploy resolved to an instance of the contract, here named "nftMarketplace", 
    // which will be used to interact with the contract
    nftMarketplace = await NFTMarketplaceFactory.deploy(
      royaltyFee,
      artist.address,
      prices,
      {value: deploymentFees}  // this is the "msg.value" needed for covering the royaltyFee for the musics deployed
    );

  });

  describe("Deployment", function () {

    // "it" => "individual test". A green tick will appear if the tests are okay
    // takes 2 arguments, decription and a callback function
    it("Updated Name, Symbol, URI, Royalty Fee and Artist", async function () {
      const nftName = "MusicNFTs"
      const nftSymbol = "MNS"
      expect(await nftMarketplace.name()).to.equal(nftName);
      expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
      expect(await nftMarketplace.baseURI()).to.equal(URI);
      expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
      expect(await nftMarketplace.artist()).to.equal(artist.address);
    });

    it("Minted all the music NFTs", async function () {

      // one token contract might use balances to represent physical objects
      // balanceOf returns the token balance of a contract's address
      // in this case, it's 8 because we are representing 8 musics using 8 tokens
      expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(prices.length);

    });

    it ("Listed all the Music NFTs", async function() {
      
      // Get each item from the marketItems array then check fields to ensure they are correct
      // "await Promise.all" will wait for all the promises to resolve
      // "map" will use the async function on all of the elements of the list "prices"
      // map's callback function takes 2 argments -> i refers to the current element of prices list and indx referes to current index
      await Promise.all(prices.map(async function (i, indx) {

        // fetching an NFT item from the market list
        const item = await nftMarketplace.marketItems(indx);

        expect(item.tokenId).to.equal(indx);
        expect(item.seller).to.equal(deployer.address);
        expect(item.price).to.equal(i);

      }));

    });

    // checking if the wallet balance of the smart contract contains the deployed fee or not
    it("Ether Balance equals to Deployment Fees", async function () {
      expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees);
    });

  });

  describe("Updated Royalty Fee", function () {

    const fee = ethToWei(0.02); 

    it("Third person CAN NOT update the Royalty Fee", async function () {
      // say we want to change the royalty fee to => 0.2 ether
      // user 1 is trying to change the royalty fee which shouldn't be permissible
      // so now testing if transaction was reverted with certain message
      await expect(nftMarketplace.connect(user1).updateRoyaltyFee(fee)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it ("Developer CAN update the Royalty Fee", async function() {
      // here the developer is trying to update the royalty fee which should be permissible
      await nftMarketplace.updateRoyaltyFee(fee); 
      expect(await nftMarketplace.royaltyFee()).to.equal(fee);  // checking if the update has been done or not
    });

  });

  describe("Purchase of Tokens", function () {

    // NOTES:
    // solidity can easily handle large numbers with uint256, but js can not handle it with safe math
    // that's why we need BigNumber in js. For doing calculation of BigNumber, 
    // we need to invoke the functions of BigNumber like BigNumber.add(value), etc.
    // But for avoiding that, and for doing the calculation using normal safe math of js,
    // we are converting every BigNumber wei to ether (which safe math can handle)

    it("Seller & Artist Received the Payment", async function() {

      // initial wallet balance of the seller (deployer at first) & artist
      // weiToEth function is needed because "getBalance" returns the balance in wei, which is a BigNumber
      const sellerInitialBalance = +weiToEth(await deployer.getBalance()); //  "+" is a unary operator which converts the value to a number
      const artistInitialBalance = +weiToEth(await artist.getBalance());  // as "weiToEth" returns an string

      // user1 is buying the nft with tokenId:0
      await nftMarketplace.connect(user1).buyToken(0, {value: prices[0]});

      // updated wallet balance of the seller & artist
      const sellerUpdatedBalance = +weiToEth(await deployer.getBalance());
      const artistUpdatedBalance = +weiToEth(await artist.getBalance());

      // checking if the wallet balance of seller and artist is updated after the transaction
      expect(sellerUpdatedBalance).to.equal(sellerInitialBalance + +weiToEth(prices[0]));  // here, we are doing normal addition, not BigNumber.add()
      expect(artistUpdatedBalance).to.equal(artistInitialBalance + +weiToEth(royaltyFee)); // that is exactly why we needed to convert wei to ether
    });

    it("Buyer is the New Owner", async function() {
      await nftMarketplace.connect(user1).buyToken(0, {value: prices[0]});

      // checking if the new owner is user1 or not
      expect(await nftMarketplace.ownerOf(0)).to.equal(user1.address);  // "ownerOf" is a function of ECR721 Contract
    });

    it("Seller Address Updated to Zero", async function() {
      await nftMarketplace.connect(user1).buyToken(0, {value: prices[0]});

      // checking the seller address of the tokenId:0
      expect((await nftMarketplace.marketItems(0)).seller).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Emitted an event of Buying a Token", async function() {
      // user1 purchases item.
      // checking if the purchase has emitted an event with the specific arguments or not
      // the arguments are => tokenId, seller, buyer, price
      await expect(nftMarketplace.connect(user1).buyToken(0, { value: prices[0] }))
        .to.emit(nftMarketplace, "MarketItemBought")
        .withArgs(0, deployer.address, user1.address, prices[0]
      )
    });

    it("Transaction Rejected when Ether amount sent does not equal Asking Price", async function () {
      // user1 trying to buy tokenId:1 with the price of tokenID:2
      await expect(
        nftMarketplace.connect(user1).buyToken(1, { value: prices[2] })
      ).to.be.revertedWith("Please send the asking price in order to complete the purchase");
    });
    
  })

  describe("Resell of Tokens", function () {

    // we are using this to make sure that user1 always purchases an item. And only then we can test the selling functions
    beforeEach(async function () {
      await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })
    })

    // user1 wil list the item back in the marketplace with a new price, which is suppose 2 ethers
    const resalePrice = ethToWei(2);

    it("Smart Contract Wallet Balance is updated", async function() {
      // fetching the initial balance of the smart contract wallet
      const smartWalletInitialBalance = +weiToEth(await ethers.provider.getBalance(nftMarketplace.address));
      // user1 is listing the music with tokenID:0 in the marketplace
      await nftMarketplace.connect(user1).resellToken(0, resalePrice, {value: royaltyFee});
      // fetching the updated balance of the smart contract wallet
      const smartWalletUpdatedBalance = +weiToEth(await ethers.provider.getBalance(nftMarketplace.address));
      // checking if the smart contract wallet balance is updated after the listing of token by user1
      // new balance = previous balance + royalty fee
      expect(smartWalletUpdatedBalance).to.equal(smartWalletInitialBalance + +weiToEth(royaltyFee));
    });

    it("Smart Contract is the New Owner", async function() {
      await nftMarketplace.connect(user1).resellToken(0, resalePrice, {value: royaltyFee});
      // checing if the new owner of the music token is the smart contract or not
      expect(await nftMarketplace.ownerOf(0)).to.equal(nftMarketplace.address);
    });

    it("Data Integrity of the Token in the Marketplace", async function() {
      await nftMarketplace.connect(user1).resellToken(0, resalePrice, {value: royaltyFee});
      // fetching info of a token from the marketplace
      const item = await nftMarketplace.marketItems(0); // marketItems array contains the data of the all the tokens
      expect(item.tokenId).to.equal(0);                 // matching the tokenId,
      expect(item.seller).to.equal(user1.address);      // seller, and
      expect(item.price).to.equal(resalePrice);         // price of the fetched item
    });

    it("Emitted an event of Selling a Token", async function() {
      // user1 lists the item on marketplace.
      // checking if the purchase has emitted an event with the specific arguments or not
      // the arguments are => tokenId, seller, price
      await expect(nftMarketplace.connect(user1).resellToken(0, resalePrice, { value: royaltyFee }))
        .to.emit(nftMarketplace, "MarketItemRelisted")
        .withArgs(0, user1.address, resalePrice
      )
    });

    it("Transaction Rejected when Price is set to Zero", async function () {
      await expect(
        nftMarketplace.connect(user1).resellToken(0, 0, { value: royaltyFee })
        ).to.be.revertedWith("Please set a Positive Number as the price of the item");
    });

    it("Transaction Rejected when required Royalty Fee is not Paid", async function () {
      await expect(
        nftMarketplace.connect(user1).resellToken(0, resalePrice, { value: 0 })
      ).to.be.revertedWith("Please send the required Royalty Fee in order to relist the item on Marketplace");
    });

  });


  describe("Getter functions", function () {
    let soldItems = [3, 5, 7];
    let ownedByUser1 = [3, 5];
    let ownedByUser2 = [7];

    beforeEach(async function () {
      // user1 purchases item 3
      await nftMarketplace.connect(user1).buyToken(3, { value: prices[3] });
      // user1 purchases item 5
      await nftMarketplace.connect(user1).buyToken(5, { value: prices[5] });
      // user2 purchases item 7
      await nftMarketplace.connect(user2).buyToken(7, { value: prices[7] });
    })

    it("Fetched the Unsold Marketplace Items", async function () {
      // gets an array of all the unsold items
      const unsoldItems = await nftMarketplace.getAllUnsoldTokens();
      // none of the elements of soldItems list should be in the unsoldItems list
      // use of "===" -> if the variable values are of different TYPES, then the values are considered as unequal.
      expect(unsoldItems.every( 
        (i) => !soldItems.some(                 // inverting it to true so that every element of unsoldItems is checked
        (j) => j === i.tokenId.toNumber()))     // should return false everytime
      )
      .to.equal(true);
      // checking if the length of the list is correct or not
      expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true)
    });

    it("Fetched the User Owned Items", async function () {
      // Get items owned by user1
      let myTokens = await nftMarketplace.connect(user1).getMyTokens();
      // every element of myTokens list should be in the ownedByUser1 list
      expect(myTokens.every(
        (i) => ownedByUser1.some(
        (j) => j === i.tokenId.toNumber())))
      .to.equal(true);
      expect(ownedByUser1.length === myTokens.length).to.equal(true);

      // Get items owned by user2
      myTokens = await nftMarketplace.connect(user2).getMyTokens()
      // every element of myTokens list should be in the ownedByUser2 list
      expect(myTokens.every(
        (i) => ownedByUser2.some(
        (j) => j === i.tokenId.toNumber())))
      .to.equal(true);
      expect(ownedByUser2.length === myTokens.length).to.equal(true);
    });

  });

});
