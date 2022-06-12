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
    //string public baseExtension = ".json";
    address public artist;  // public address of the artist so that our contract knows which account to pay the royalty fees to. this is not set as payable because it's public
    uint256 public royaltyFee;  // the fee which the artist will receive for each time reselling

    struct MarketItem {
        uint256 tokenId;  // id for each music
        address payable seller;  // address of the seller, and for receiving the ether payment, the type needs to payable 
        uint256 price;  // price of a music
    }

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

    MarketItem[] public marketItems;  // this array works like a "collection" of all the music nfts in the marketplace

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
            MarketItem memory music_nft = MarketItem(i, payable(msg.sender), _prices[i]); // data of a music nft stored in an object
            marketItems.push(music_nft);  // inserting all the freshly minted music nfts in the nft-collection
        }
    }


    function updateRoyaltyFee(uint256 _royaltyFee) external onlyOwner {
        royaltyFee = _royaltyFee;
    }

    function buyToken(uint256 _tokenId) external payable {
        uint256 price = marketItems[_tokenId].price;
        address seller = marketItems[_tokenId].seller;

        require(msg.value == price, "Please send the asking price in order to complete the purchase");
        
        marketItems[_tokenId].seller = payable(address(0));
        _transfer(address(this), msg.sender, _tokenId);
        payable(artist).transfer(royaltyFee);
        payable(seller).transfer(msg.value);

        emit MarketItemBought(_tokenId, seller, msg.sender, price);
    }

    function resellToken(uint256 _tokenId, uint256 _price) external payable {
        require(msg.value == royaltyFee, "Must pay royalty");
        require(_price > 0, "Price must be greater than zero");

        marketItems[_tokenId].price = _price;
        marketItems[_tokenId].seller = payable(msg.sender);

        _transfer(msg.sender, address(this), _tokenId);

        emit MarketItemRelisted(_tokenId, msg.sender, _price);
    }

    function getAllUnsoldTokens() external view returns(MarketItem[] memory) {
        uint256 unsoldCount = balanceOf(address(this));  // returns the number of tokens in the account of the particular address
        MarketItem[] memory tokens = new MarketItem[] (unsoldCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < marketItems.length; ++i) {
            if (marketItems[i].seller != address(0)) {
                tokens[currentIndex] = marketItems[i];
                ++currentIndex;
            }
        }

        return (tokens);
    }

    function getMyTokens() external view returns(MarketItem[] memory) {
        uint256 myTokenCount = balanceOf(msg.sender);
        MarketItem[] memory tokens = new MarketItem[] (myTokenCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < marketItems.length; ++i) {
            if (ownerOf(i) == msg.sender) {  // ownerOf returns the address of the owner of a particular token
                tokens[currentIndex] = marketItems[i];
                ++currentIndex;
            }
        }

        return (tokens);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

}
