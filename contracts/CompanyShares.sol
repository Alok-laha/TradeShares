// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CompanyShares is ERC20, Ownable {
    uint256 public constant MAX_SHARES_PER_WALLET = 10;
    uint256 public constant MAX_SHARES_PER_TX = 5;
    uint256 public constant PRICE_PER_SHARE = 1 ether;
    uint256 public requestIdCounter = 1;

    struct SellRequest {
        uint256 id;
        address seller;
        uint256 amount;
        bool isActive;
        address selectedBuyer;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        bool isConfirmed;
    }

    mapping(uint256 => SellRequest) public sellRequests;
    mapping(uint256 => Bid[]) public bids;
    mapping(address => uint256) public sharesOwned;
    mapping(address => uint256) public activeRequest;

    event SharesBought(address indexed buyer, uint256 amount);
    event SellRequestCreated(uint256 requestId, address indexed seller, uint256 amount);
    event BidPlaced(uint256 requestId, address indexed bidder, uint256 amount);
    event ShareSold(uint256 requestId, address indexed seller, address indexed buyer, uint256 amount);

    constructor() ERC20("CompanyShares", "CST") Ownable(msg.sender) {
        _mint(msg.sender, 50); // Owner gets 50 shares
        _mint(address(this), 50); // Contract holds 50 shares for sale
    }

    // Buy shares from contract
    function buyShares(uint256 amount) external payable {
        require(amount > 0 && amount <= MAX_SHARES_PER_TX, "Can buy 1 to 5 shares at a time");
        require(sharesOwned[msg.sender] + amount <= MAX_SHARES_PER_WALLET, "Max 10 shares per wallet");
        require(balanceOf(address(this)) >= amount, "Not enough shares left");
        require(msg.value >= ((amount * PRICE_PER_SHARE) / 1 ether), "Insufficient fund");

        _transfer(address(this), msg.sender, amount);
        sharesOwned[msg.sender] += amount;
        payable(owner()).transfer(msg.value);

        emit SharesBought(msg.sender, amount);
    }

    // Create a sell request
    function createSellRequest(uint256 amount) external {
        require(sharesOwned[msg.sender] >= amount, "Not enough shares to sell");
        require(sellRequests[activeRequest[msg.sender]].isActive == false, "You already have one active request pending");
        
        uint256 requestId = requestIdCounter++;
        sellRequests[requestId] = SellRequest({
            id: requestId,
            seller: msg.sender,
            amount: amount,
            isActive: true,
            selectedBuyer: address(0)
        });
        activeRequest[msg.sender] = requestId;

        emit SellRequestCreated(requestId, msg.sender, amount);
    }

    // Place a bid on a sell request
    function placeBid(uint256 requestId, uint256 price) external {
        require(sellRequests[requestId].isActive, "Sell request is not active");
        require(sharesOwned[msg.sender] + sellRequests[requestId].amount <= MAX_SHARES_PER_WALLET, "Exceeds wallet limit");

        bids[requestId].push(Bid({
            bidder: msg.sender,
            amount: price, // How much the buyer wish to pay
            isConfirmed: false
        }));

        emit BidPlaced(requestId, msg.sender, price);
    }

    function getMyRequest() external view returns (Bid[] memory){
        return bids[activeRequest[msg.sender]];
    }

    // Get the amount of shared owned
    function getSharesOwned() public view returns (uint256){
        return sharesOwned[msg.sender];
    }

    // Seller selects a bidder and completes the sale
    function finalizeSale(uint256 requestId, address buyer) external {
        SellRequest storage request = sellRequests[requestId];
        require(request.isActive, "Sell request is not active");
        require(request.seller == msg.sender, "Only seller can finalize");
        require(isValidBid(requestId, buyer), "Invalid bidder");

        Bid[] memory bidsForRequest = bids[requestId];
        uint256 totalPrice;
        uint256 bidIndex = 0;
        for(uint256 i=0; i<bidsForRequest.length; i++){
            if(bidsForRequest[i].bidder == buyer) {
                totalPrice = bidsForRequest[i].amount;
                bidIndex = i;
            }
        }
        require(address(buyer).balance >= totalPrice, "Buyer has insufficient funds");

        // Here we just need to update the status of this bid to be confirmed
        // Then buyer will check his bid and pay from his wallet
        bids[requestId][bidIndex].isConfirmed = true;
    }

    // Buyer pays for the confirmed trade
    function payForTrade(uint256 requestId) external payable{
        SellRequest storage request = sellRequests[requestId];

        Bid[] memory bidsForRequest = bids[requestId];
        uint256 totalPrice;
        for(uint256 i=0; i<bidsForRequest.length; i++){
            if(bidsForRequest[i].bidder == msg.sender) {
                totalPrice = bidsForRequest[i].amount;
            }
        }

        require((msg.value/1 ether) == totalPrice, "Invalid bid amount");
        totalPrice = totalPrice * 10**18;
        payable(request.seller).transfer(totalPrice);

        // Transfer shares from seller to buyer
        _transfer(request.seller, msg.sender, request.amount);
        sharesOwned[request.seller] -= request.amount;
        sharesOwned[msg.sender] += request.amount;

        // Mark request as completed
        request.isActive = false;
        request.selectedBuyer = msg.sender;
        emit ShareSold(requestId, request.seller, msg.sender, request.amount);
    }

    // Check if the given buyer has placed a valid bid
    function isValidBid(uint256 requestId, address buyer) internal view returns (bool) {
        Bid[] memory requestBids = bids[requestId];
        for (uint256 i = 0; i < requestBids.length; i++) {
            if (requestBids[i].bidder == buyer) {
                return true;
            }
        }
        return false;
    }

    // Withdraw Ether (Only Owner)
    function withdrawEther() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
