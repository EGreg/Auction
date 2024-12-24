// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0 <0.9.0;
interface IAuction {
    
    struct BidStruct {
        address bidder;
        bool offchain;
        uint256 amount;
    }
    struct Increase {
        uint128 amount; // can't increase by over half the range
        uint32 numBids; // increase after this many bids
        bool canBidAboveIncrease;
    }
    
    function initialize(
        address token,
        bool cancelable,
        uint64 startTime,
        uint64 endTime,
        uint64 claimPeriod,
        uint32 maxWinners,
        uint32 winnerClaimInterval,
        uint256 startingPrice,
        Increase memory increase
    ) external;
    
    function bid(uint256 amount) external;
    function winning() external view returns (BidStruct[] memory result);
    function cancel() external;
    function withdraw(address recipient) external;
    
    function addManager(address manager) external;
    function removeManager(address manager) external;
    function bidOffchain(address participant, uint256 amount) external;
    function refund(address participant) external;

    function claim(address nftContract, uint256 tokenId, address recipient) external;
    function claimMultiple(address[] calldata nftContracts, uint256[] calldata tokenIds, address[] calldata recipients) external;
    function NFTtransfer(address nftContract, uint256 tokenId, address recipient) external;
    
}