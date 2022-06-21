// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// MusicNFTs = name of the token
// MNS = symbol of the token
// these 2 parameters are needed for the constructor of Openzeppelin implementation of ERC721 standard.

contract MusicNFTMarketplace is ERC721("MusicNFTs", "MNS"), Ownable {  // inheriting the 2 contracts for handling tokens which are non funginble

    // the IPFS link where the metadata for the musics are stored
    string public baseURI = "https://bafybeidhjjbjonyqcahuzlpt7sznmh4xrlbspa3gstop5o47l6gsiaffee.ipfs.nftstorage.link/";  
    // string public baseExtension = ".json";
    address public artist;  // public address of the artist so that our contract knows which account to pay the royalty fees to. this is not set as payable because it's public
    uint256 public royaltyFee;  // the fee which the artist will receive for each time reselling

    struct MarketItem {
        uint256 tokenId;  // id for each music
        address payable seller;  // address of the seller, and for receiving the ether payment, the type needs to payable 
        uint256 price;  // price of a music
    }

    MarketItem[] public marketItems;  // this array works like a "collection" of all the music nfts in the marketplace

    // events allow us to log data to the ethereum blockchain
    // "indexed" helps us to search using these variables as filters
    event MarketItemBought (
        uint256 indexed tokenId, 
        address indexed seller,
        address buyer,
        uint256 price
    );

    event MarketItemRelisted (
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    // the constructor is used to initialize the "address" and "royalty fee" of the artist and also the "prices of all the musics" created by the artist
    // payable because it is required for the smart contract deployer (i.e the first seller) to cover the royalty fees or listing the nfts in the marketplace
    constructor(uint256 _royaltyFee, address _artist, uint256[] memory _prices) payable { 
        
        //prices.length = number of musics in the marketplace
        require(msg.value >= _prices.length * _royaltyFee, "Please pay the required Royalty Fee for all the Tokens listed on the Marketplace");
        
        // initializing the state variables
        royaltyFee = _royaltyFee;
        artist = _artist;

        for(uint8 i = 0; i < _prices.length; i++) {
            require(_prices[i] > 0, "Prices must be greater than Zero");
            _mint(address(this), i);  // minting (publishing on blockchain) each tokenID for this contract address
            MarketItem memory music_nft = MarketItem(i, payable(msg.sender), _prices[i]); // data of a music nft stored in a struct
            marketItems.push(music_nft);  // inserting all the freshly minted music nfts in the nft-collection
        }
    }

    // this function is for updating the royaltyFee
    // "onlyOwner" is a modifier, which checks if the function is being called by the owner
    function updateRoyaltyFee(uint256 _royaltyFee) external onlyOwner {
        royaltyFee = _royaltyFee;
    }

    // this is the function an user will call if it wants to buy a music nft
    function buyToken(uint256 _tokenId) external payable {
        uint256 price = marketItems[_tokenId].price;    // current price of the particular token
        address seller = marketItems[_tokenId].seller;  // current seller of the particular token

        // checking if the sent money is equal to the current price or not
        require(msg.value == price, "Please send the asking price in order to complete the purchase");

        // the fees are transferred to the wallets of both the artist and the seller
        // payable type-casting is done to invoke the function "transfer"
        payable(artist).transfer(royaltyFee);  // royaltyFee amount is transferred from smart contract wallet to artist's wallet
        payable(seller).transfer(msg.value);
    
        // "_transfer" arguments are => from, to, tokenID
        // when buying tokens, token ownership are transferred from the address of the smart contract to the buyer
        _transfer(address(this), msg.sender, _tokenId);  // "_transfer" is a function of ERC721 Contract

        // as the item is sold, the new seller is No One
        marketItems[_tokenId].seller = payable(address(0));

        // emitting the event with tokenId, seller , buyer and price
        emit MarketItemBought(_tokenId, seller, msg.sender, price);
    }

    // this is the function to relist a music nft owned by an user, back in the marketplace
    function resellToken(uint256 _tokenId, uint256 _price) external payable {

        // checking if the money sent is equal to the royalty fee or not 
        require(msg.value == royaltyFee, "Please send the required Royalty Fee in order to relist the item on Marketplace");
        // checking if the asking price is a positive number or not, else doesn't make any sense 
        require(_price > 0, "Please set a Positive Number as the price of the item");

        // the nft ownership is transferred to the smart wallet
        _transfer(msg.sender, address(this), _tokenId);

        // updating the marketItems array with new price and seller
        marketItems[_tokenId].price = _price;
        marketItems[_tokenId].seller = payable(msg.sender);

        // emitting an event to log the reselling data on the blockchain
        emit MarketItemRelisted(_tokenId, msg.sender, _price);
    }

    // this function is for returning the list of music nfts which are in the marketplace but not yet bought by any user
    function getAllUnsoldTokens() external view returns(MarketItem[] memory) {
        // retrieving how many nfts, the smart contract is owner of. Only unsold tokens have the address of smart contract as the owner.
        uint256 unsoldCount = balanceOf(address(this));  
        // creating an array of the same size, because we will be returning those unsold nfts/tokens
        MarketItem[] memory unsoldTokens = new MarketItem[] (unsoldCount); 
        // this variable works as an iterator for our newly created array
        uint256 currentIndex = 0;

        // we are looping through all the tokens in the marketplace
        for (uint256 i = 0; i < marketItems.length; ++i) {
            // only selecting those tokens, which have Non-Zero as seller address. Because zero address refers to that token been sold.
            if (marketItems[i].seller != address(0)) {
                unsoldTokens[currentIndex] = marketItems[i];  // copying that token in our newly created array
                ++currentIndex;  // controlling the iterator of our newly created array
            }
        }

        return unsoldTokens;
    }

    // this function is for fetching the owned nfts/tokens of a particular user
    function getMyTokens() external view returns(MarketItem[] memory) {
        // retrieving how many nfts, the function calling user is owner of
        uint256 myTokenCount = balanceOf(msg.sender);

        MarketItem[] memory myTokens = new MarketItem[] (myTokenCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < marketItems.length; ++i) {
            // only selecting those tokens, whose owner is the function calling user
            if (ownerOf(i) == msg.sender) {
                myTokens[currentIndex] = marketItems[i];
                ++currentIndex;
            }
        }

        return myTokens;
    }

    // this function is for returning the IPFS baseURI where all the nft metadata are stored
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

}
