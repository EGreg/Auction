// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.18;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

import "./interfaces/IAuction.sol";
import "./interfaces/IAuctionFactory.sol";

//import "hardhat/console.sol";
contract Auction is IAuction, ReentrancyGuardUpgradeable, OwnableUpgradeable {

    address deployer; // who called produce() or produceDeterministic(). it's our factory
    address token;

    bool canceled;
    bool cancelable;
    uint64 startTime;
    uint64 endTime;
    uint64 claimPeriod;
    uint256 startingPrice;
    uint256 currentPrice;
    Increase priceIncrease;

    BidStruct[] public bids;
    uint32 public maxWinners;
    uint32 public winnerClaimInterval;
    uint32 public winningSmallestIndex; // starts at 1

    struct WinningStruct {
        uint32 bidIndex;
        bool claimed;
    }
    mapping (address => WinningStruct) winningBidIndex; // 1-based index, thus 0 means not winning
    mapping (address => bool) managers;

    event AlreadyWinning(address bidder, uint256 index);
    event Bid(address bidder, uint256 amount, uint32 numBids);
    event RefundedBid(address bidder, uint256 amount);
    event SpentBid(address bidder, uint256 amount);

    error OutsideOfIntercoinEcosystem();
    error ChargeFailed();
    error BidTooSmall();
    error NotWinning();
    error AlreadyClaimed();
    error SubscribeFailed();
    error NotCancelable();
    error CannotBidAboveCurrentPrice();
    error CannotWithdrawDuringClaimPeriod();

    error AuctionWasCanceled();
    error AuctionNotCanceled();
    error AuctionNotFinished();
    error MaximumBidsAmountExceeded();

    error NFTAlreadyClaimed();
    error NFTNotFound();

    error WrongClaimInterval();
    error OutOfClaimPeriod();
    error InvalidClaimParams();

    modifier onlyOwnerOrManager() {
        _onlyOwnerOrManager();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address token_,
        bool cancelable_,
        uint64 startTime_,
        uint64 endTime_,
        uint64 claimPeriod_,
        uint32 maxWinners_,
        uint32 winnerClaimInterval_,
        uint256 startingPrice_,
        Increase memory increase_
    ) 
        external 
        initializer 
    {
        
        __Ownable_init();
        __ReentrancyGuard_init();
        deployer = msg.sender;

        token = token_;
        canceled = false;
        cancelable = cancelable_;
        startTime = startTime_;
        endTime = endTime_;
        claimPeriod = claimPeriod_;
        startingPrice = startingPrice_;
        priceIncrease.amount = increase_.amount;
        priceIncrease.numBids = increase_.numBids;
        priceIncrease.canBidAboveIncrease = increase_.canBidAboveIncrease;
        maxWinners = maxWinners_;
        winnerClaimInterval = winnerClaimInterval_;

        winningBidIndex[address(0)].bidIndex = 0;
        bids.push(BidStruct(address(0), false, 0));
        winningSmallestIndex++;

        if (
            winnerClaimInterval != 0 &&
            endTime + claimPeriod < endTime + maxWinners*winnerClaimInterval
        ) {
            revert InvalidClaimParams();
        }

    }

    function bid(uint256 amount) payable public {
        _bid(_msgSender(), amount, false);
    }

    // return winning bids, from largest to smallest
    function winning() external view returns (BidStruct[] memory result) {
        uint32 l = uint32(bids.length);
        
        result = new BidStruct[](l-winningSmallestIndex);
        uint256 ii = 0;
        for (uint32 i=l-1; i >= winningSmallestIndex; --i) {
            result[ii] = bids[i];
            ii++;
        }
    }

    // sends all the money back to the people
    function cancel() external onlyOwnerOrManager {
        if (!cancelable) {
            revert NotCancelable();
        }
        uint32 l = uint32(bids.length);
        for (uint32 i=winningSmallestIndex; i<l; ++i) {
            _refundBid(i); // send money back
        }
        canceled = true;
    }

    function refund(address bidder) external onlyOwnerOrManager {
        
        uint32 l = uint32(bids.length);
        uint32 index;
        bool done = false;
        for (uint32 i=winningSmallestIndex; i<l; ++i) {
            done = _refundIfBidder(i, bidder); // send money back
            if (done) {
                index = i;
                break;
            }
        }
        if (done) {
            for (uint32 i=index; i<l-1; ++i) {
                bids[i] = bids[i+1];
            }
            bids.pop();
        }
    }

    function bidOffchain(
        address bidder,
        uint256 amount
    ) 
        external 
        onlyOwnerOrManager
    {
        _bid(bidder, amount, true);
    }


    // owner withdraws all the money after auction is over
    function withdraw(address recipient) external onlyOwnerOrManager {
        withdrawValidate();

        // if (token == address(0)) {
        //     send(recipient, this.balance);
        // } else {
        //     IERC20(token).transfer(recipient, IERC20(token).balanceOf(this));
        // }
        uint256 totalContractBalance = IERC20Upgradeable(token).balanceOf(address(this));
        IERC20Upgradeable(token).transfer(recipient, totalContractBalance);
    }

    // auction winners can claim any NFT owned by the auction,
    // and shouldn't bid unless the count > maxWinners
    function claim(address nftContract, uint256 tokenId, address recipient) external {
        //address sender = _msgSender();
        _claim(recipient, nftContract, tokenId);
    }

    function claimMultiple(address[] calldata nftContracts, uint256[] calldata tokenIds, address[] calldata recipients) external {
        for(uint256 i=0; i < nftContracts.length; i++ ) {
            _claim(recipients[i], nftContracts[i], tokenIds[i]);
        }
    }
 
    // auction owner can send the NFTs anywhere if auction was canceled or pass claimPeriodTime
    // the auction owner would typically have been owner of all the NFTs sent to it
    function NFTtransfer(address nftContract, uint256 tokenId, address recipient) external onlyOwnerOrManager {
        
        if (!canceled || block.timestamp <= endTime + claimPeriod) {
            revert AuctionNotCanceled();
        }
        
        ERC721Upgradeable(nftContract).safeTransferFrom(address(this), recipient, tokenId);
        if (bids.length > 0) {
            _refundBid(winningSmallestIndex);
            winningSmallestIndex++;
        }

        
    }
    function addManager(address manager) external onlyOwner {
        managers[manager] = true;
    }
    function removeManager(address manager) external onlyOwner {
        managers[manager] = false;
    }

    function _onlyOwnerOrManager() internal view virtual {
        address ms = _msgSender();
        require(owner() == ms || managers[ms] == true, "Ownable: caller is not the owner or manager");
    }

    function _bid(address bidder, uint256 amount, bool offchain) internal {
        
        uint32 index = winningBidIndex[bidder].bidIndex;

        if (index > 0) {
            emit AlreadyWinning(bidder, index);
            return;
        }

        if (token != address(0) && amount == 0) {
            amount = currentPrice;
        }
        if (amount < currentPrice) {
            revert BidTooSmall();
        }
        if (currentPrice < amount) {
            if (!priceIncrease.canBidAboveIncrease) {
                revert CannotBidAboveCurrentPrice();
            }
            currentPrice = amount;
        }
        if (!offchain) {
            _charge(bidder, amount);
        }

        if (bids.length % priceIncrease.numBids == 0) {
            currentPrice += priceIncrease.amount; // every so often
        }
        
        if (bids.length > maxWinners) {
            _refundBid(winningSmallestIndex);
            winningSmallestIndex++;
        }

        if (bids.length > type(uint32).max) {
            revert MaximumBidsAmountExceeded();
        }


        bids.push(BidStruct(bidder, offchain, amount));

        winningBidIndex[bidder].bidIndex = uint32(bids.length) - 1;
        emit Bid(bidder, amount, uint32(bids.length));
        
    }

    function withdrawValidate() internal view {
        if (block.timestamp < endTime) {
            revert AuctionNotFinished();
        }
        

        uint32 l = uint32(bids.length);
        uint256 numClaimed = 0;
        for (uint32 i=l-1; i >= winningSmallestIndex; --i) {
            if (winningBidIndex[bids[i].bidder].claimed == true) {
                numClaimed++;
            }
        }

        if (
            (block.timestamp >= endTime + claimPeriod) ||
            (numClaimed == maxWinners) 
        ) {
            // pass condition
        } else {
            revert CannotWithdrawDuringClaimPeriod();
        }
        
    }
   
    // should be call in any variant of claim
    // validation sender as winner, setup sender as already claimed and trying to send NFT
    function _claim(address winner, address nftContract, uint256 tokenId) internal {
        requireWinner(winner);
        winningBidIndex[winner].claimed = true;

        //nftContract.safeTransferFrom(address(this), winner, tokenId); // will revert if not owned
        try ERC721Upgradeable(nftContract).safeTransferFrom(address(this), winner, tokenId) {
            // all ok
        } catch {
            // else if any errors. do refund
            _refundBid(winningBidIndex[winner].bidIndex);
        }
    }
     
    function requireWinner(address sender) internal view {
        if (canceled) {
            revert AuctionWasCanceled();
        }
        if (block.timestamp < endTime) {
            revert AuctionNotFinished();
        }
        
        if (winningBidIndex[sender].bidIndex == 0) {
            revert NotWinning();
        }
        if (winningBidIndex[sender].claimed == true) {
            revert AlreadyClaimed();
        }

        if (endTime + claimPeriod < block.timestamp) {
            revert OutOfClaimPeriod();
        }

        uint256 orderInClaim = winningBidIndex[sender].bidIndex - winningSmallestIndex;
        if (endTime + orderInClaim*winnerClaimInterval < block.timestamp) {
            revert WrongClaimInterval();
        }

    }

    // send back the bids when someone isn't winning anymore
    function _refundBid(uint32 index) internal {
        BidStruct storage b = bids[index];
        // if (token == address(0)) {
        //     send(b.bidder, b.amount);
        // } else {
        //     IERC20(token).transfer(b.bidder, b.amount);
        // }
        if (!b.offchain) {
            IERC20Upgradeable(token).transfer(b.bidder, b.amount);
        }
        emit RefundedBid(b.bidder, b.amount);
        //bids[winningSmallestIndex] = 0; // or maybe use delete
        delete bids[index];
        delete winningBidIndex[b.bidder];
        
    }

    function _refundIfBidder(uint32 index, address bidder) internal returns(bool) {
        if (bidder == bids[index].bidder) {
            _refundBid(index);
            return true;
        }
        return false;
    }
    
    function _charge(address payer, uint256 amount) private {
        bool success = IAuctionFactory(deployer).doCharge(token, amount, payer, address(this));
        if (!success) {
            revert ChargeFailed();
        }
    }


}