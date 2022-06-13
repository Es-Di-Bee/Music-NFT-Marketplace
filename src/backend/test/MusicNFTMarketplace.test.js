// require() statement basically reads a JavaScript file, executes it, and then proceeds to return the export object
// "expect" is a function of "chai"
const { expect } = require("chai"); 

// arrow functions for converting from ethers to wei and vice-versa
const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

// "describe" is a mocha function for grouping tests together
//  takes 2 arguments -> name of the test, callback function (function which is passed as an argument to another function)
describe("MusicNFTMarketplace Testing", function () {

  let nftMarketplace;
  let deployer, artist, user1, user2, users;  // address of all the associated persons
  let royaltyFee = toWei(0.01); // the artist will receive 0.01 ether for each reselling
  let URI = "https://bafybeidhjjbjonyqcahuzlpt7sznmh4xrlbspa3gstop5o47l6gsiaffee.ipfs.nftstorage.link/";  // the URI where all the musics are stored
  let prices = [toWei(1), toWei(2), toWei(3), toWei(4), toWei(5), toWei(6), toWei(7), toWei(8)];  // setting the prices for each of the musics in the marketplace
  let deploymentFees = toWei(prices.length * 0.01);  // the deployer will need to pay the royaltyFee for all the musics

  // beforeEach will run this async function before every "it"
  beforeEach(async function () {

    // ContractFactory is needed for the deployment of the smart contract
    const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");

    // GetSigners returns the accounts of all the nodes in the blockchain. 
    // "...users" will contain the list of the accounts of user3 till lastUser
    [deployer, artist, user1, user2, ...users] = await ethers.getSigners();

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
    it("Tracking name, symbol, URI, royalty fee and artist", async function () {
      const nftName = "MusicNFTs"
      const nftSymbol = "MNS"
      expect(await nftMarketplace.name()).to.equal(nftName);
      expect(await nftMarketplace.symbol()).to.equal(nftSymbol);
      expect(await nftMarketplace.baseURI()).to.equal(URI);
      expect(await nftMarketplace.royaltyFee()).to.equal(royaltyFee);
      expect(await nftMarketplace.artist()).to.equal(artist.address);
    });

    it("Minting all the music NFTs", async function () {

      // one token contract might use balances to represent physical objects
      // balanceOf returns the token balance of a contract's address
      // in this case, it's 8 because we are representing 8 musics using 8 tokens
      expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.equal(prices.length);

    });

    it ("Listing all the Music NFTs", async function() {
      
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

      }))

    });

    // checking if the wallet balance of the smart contract contains the deployed fee or not
    it("Ether Balance = Deployment Fees", async function () {
      expect(await ethers.provider.getBalance(nftMarketplace.address)).to.equal(deploymentFees)
    });

  });

  describe("Updating royalty fee", function () {

    it("Third person CAN NOT update the Royalty Fee", async function () {
      const fee = toWei(0.02);  // say we want to change the royalty fee to => 0.2 ether
      // user 1 is trying to change the royalty fee which shouldn't be permissible
      // so now testing if transaction was reverted with certain message
      await expect(nftMarketplace.connect(user1).updateRoyaltyFee(fee)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it ("Developer CAN update the Royalty Fee", async function() {
      const fee = toWei(0.02);
      // here the developer is trying to update the royalty fee which should be permissible
      await nftMarketplace.updateRoyaltyFee(fee); 
      expect(await nftMarketplace.royaltyFee()).to.equal(fee);  // checking if the update has been done or not
    });

  });

  describe("Buying tokens", function () {

    it("Should update seller to zero address, transfer NFT, pay seller, pay royalty to artist and emit a MarketItemBought event", async function () {
      const deployerInitalEthBal = await deployer.getBalance()
      const artistInitialEthBal = await artist.getBalance()
      // user1 purchases item.
      await expect(nftMarketplace.connect(user1).buyToken(0, { value: prices[0] }))
        .to.emit(nftMarketplace, "MarketItemBought")
        .withArgs(0, deployer.address, user1.address, prices[0]
        )
      const deployerFinalEthBal = await deployer.getBalance()
      const artistFinalEthBal = await artist.getBalance()
      // Item seller should be zero addr
      expect((await nftMarketplace.marketItems(0)).seller).to.equal("0x0000000000000000000000000000000000000000")
      // Seller should receive payment for the price of the NFT sold.
      expect(+fromWei(deployerFinalEthBal)).to.equal(+fromWei(prices[0]) + +fromWei(deployerInitalEthBal))
      // Artist should receive royalty
      expect(+fromWei(artistFinalEthBal)).to.equal(+fromWei(royaltyFee) + +fromWei(artistInitialEthBal))
      // The buyer should now own the nft
      expect(await nftMarketplace.ownerOf(0)).to.equal(user1.address);
    })


    it("Should fail when ether amount sent with transaction does not equal asking price", async function () {
      // Fails when ether sent does not equal asking price
      await expect(
        nftMarketplace.connect(user1).buyToken(0, { value: prices[1] })
      ).to.be.revertedWith("Please send the asking price in order to complete the purchase");
    });
    
  })

  describe("Reselling tokens", function () {

    beforeEach(async function () {
    // user1 purchases an item.
    await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })
    })

    it("Should track resale item, incr. ether bal by royalty fee, transfer NFT to marketplace and emit MarketItemRelisted event", async function () {
      const resaleprice = toWei(2)
      const initMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
      // user1 lists the nft for a price of 2 hoping to flip it and double their money
      await expect(nftMarketplace.connect(user1).resellToken(0, resaleprice, { value: royaltyFee }))
        .to.emit(nftMarketplace, "MarketItemRelisted")
        .withArgs(
        0,
        user1.address,
        resaleprice
        )
      const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address)
      // Expect final market bal to equal inital + royalty fee
      expect(+fromWei(finalMarketBal)).to.equal(+fromWei(royaltyFee) + +fromWei(initMarketBal))
      // Owner of NFT should now be the marketplace
      expect(await nftMarketplace.ownerOf(0)).to.equal(nftMarketplace.address);
      // Get item from items mapping then check fields to ensure they are correct
      const item = await nftMarketplace.marketItems(0)
      expect(item.tokenId).to.equal(0)
      expect(item.seller).to.equal(user1.address)
      expect(item.price).to.equal(resaleprice)
    });

    it("Should fail if price is set to zero and royalty fee is not paid", async function () {
      await expect(
        nftMarketplace.connect(user1).resellToken(0, 0, { value: royaltyFee })
        ).to.be.revertedWith("Price must be greater than zero");
      await expect(
        nftMarketplace.connect(user1).resellToken(0, toWei(1), { value: 0 })
        ).to.be.revertedWith("Must pay royalty");
    });
  });


  describe("Getter functions", function () {
    let soldItems = [0, 1, 4]
    let ownedByUser1 = [0, 1]
    let ownedByUser2 = [4]
    beforeEach(async function () {
      // user1 purchases item 0.
      await (await nftMarketplace.connect(user1).buyToken(0, { value: prices[0] })).wait();
      // user1 purchases item 1.
      await (await nftMarketplace.connect(user1).buyToken(1, { value: prices[1] })).wait();
      // user2 purchases item 4.
      await (await nftMarketplace.connect(user2).buyToken(4, { value: prices[4] })).wait();
    })

    it("getAllUnsoldTokens should fetch all the marketplace items up for sale", async function () {
      const unsoldItems = await nftMarketplace.getAllUnsoldTokens()
      // Check to make sure that all the returned unsoldItems have filtered out the sold items.
      expect(unsoldItems.every(i => !soldItems.some(j => j === i.tokenId.toNumber()))).to.equal(true)
      // Check that the length is correct
      expect(unsoldItems.length === prices.length - soldItems.length).to.equal(true)
    });
    it("getMyTokens should fetch all tokens the user owns", async function () {
      // Get items owned by user1
      let myItems = await nftMarketplace.connect(user1).getMyTokens()
      // Check that the returned my items array is correct
      expect(myItems.every(i => ownedByUser1.some(j => j === i.tokenId.toNumber()))).to.equal(true)
      expect(ownedByUser1.length === myItems.length).to.equal(true)
      // Get items owned by user2
      myItems = await nftMarketplace.connect(user2).getMyTokens()
      // Check that the returned my items array is correct
      expect(myItems.every(i => ownedByUser2.some(j => j === i.tokenId.toNumber()))).to.equal(true)
      expect(ownedByUser2.length === myItems.length).to.equal(true)
    });
  });

});
