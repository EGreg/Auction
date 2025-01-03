// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.18;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

import "./interfaces/IAuction.sol";
import "./interfaces/IAuctionFactory.sol";

// Constants for chain-dependent addresses
uint256 constant ETHEREUM_CHAIN_ID = 0x1;
uint256 constant ARBITRUM_CHAIN_ID = 0xa4b1;
uint256 constant BASE_CHAIN_ID = 0x210d;
uint256 constant OPTIMISM_CHAIN_ID = 0xa;
uint256 constant BSC_CHAIN_ID = 0x38;
uint256 constant POLYGON_CHAIN_ID = 0x89;

address constant ETHEREUM_UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant ETHEREUM_CURVE_REGISTRY = 0x0000000022D53366457F9d5E68Ec105046FC4383;

address constant ARBITRUM_UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant ARBITRUM_CURVE_REGISTRY = address(0);

address constant BASE_UNISWAP_ROUTER = address(0);
address constant BASE_CURVE_REGISTRY = address(0);

address constant OPTIMISM_UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant OPTIMISM_CURVE_REGISTRY = address(0);

address constant BSC_UNISWAP_ROUTER = address(0);
address constant BSC_CURVE_REGISTRY = address(0);

address constant POLYGON_UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant POLYGON_CURVE_REGISTRY = address(0);

// Interface for Curve Pool with find_coin_index
interface ICurveRegistry {
    function find_pool_for_coins(address from, address to) external view returns (address);
}

interface ICurvePool {
    function find_coin_index(address token) external view returns (uint256);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external;
}

//import "hardhat/console.sol";
contract Auction is IAuction, ReentrancyGuardUpgradeable, OwnableUpgradeable {

    address deployer; // who called produce() or produceDeterministic(). 

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

    address public token; // Main token for the auction
    address public curveRegistry; // Curve Registry for the current chain
    address public uniswapRouter; // Uniswap Router for the current chain

    function initialize(
        address token_,
        uint256 chainId,
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
            endTime + claimPeriod < endTime + maxWinners * winnerClaimInterval
        ) {
            revert InvalidClaimParams();
        }

        // Chain-specific address assignment
        if (chainId == ETHEREUM_CHAIN_ID) {
            uniswapRouter = ETHEREUM_UNISWAP_ROUTER;
            curveRegistry = ETHEREUM_CURVE_REGISTRY;
        } else if (chainId == ARBITRUM_CHAIN_ID) {
            uniswapRouter = ARBITRUM_UNISWAP_ROUTER;
            curveRegistry = ARBITRUM_CURVE_REGISTRY;
        } else if (chainId == BASE_CHAIN_ID) {
            uniswapRouter = BASE_UNISWAP_ROUTER;
            curveRegistry = BASE_CURVE_REGISTRY;
        } else if (chainId == OPTIMISM_CHAIN_ID) {
            uniswapRouter = OPTIMISM_UNISWAP_ROUTER;
            curveRegistry = OPTIMISM_CURVE_REGISTRY;
        } else if (chainId == BSC_CHAIN_ID) {
            uniswapRouter = BSC_UNISWAP_ROUTER;
            curveRegistry = BSC_CURVE_REGISTRY;
        } else if (chainId == POLYGON_CHAIN_ID) {
            uniswapRouter = POLYGON_UNISWAP_ROUTER;
            curveRegistry = POLYGON_CURVE_REGISTRY;
        } else {
            revert("Unsupported chain ID");
        }
    }

    function useCurveDEX(address bidToken, uint256 amount) internal returns (bool) {
        if (curveRegistry == address(0)) {
            return false; // Curve registry not available, fallback to Uniswap
        }

        // Find the Curve pool for the token pair
        address curvePool = ICurveRegistry(curveRegistry).find_pool_for_coins(bidToken, token);
        if (curvePool == address(0)) {
            return false; // No Curve pool found, fallback to Uniswap
        }

        IERC20Upgradeable(bidToken).approve(curvePool, amount);

        uint256 tokenIndexFrom = ICurvePool(curvePool).find_coin_index(bidToken);
        uint256 tokenIndexTo = ICurvePool(curvePool).find_coin_index(token);

        try ICurvePool(curvePool).exchange(tokenIndexFrom, tokenIndexTo, amount, 0) {
            return true; // Successful Curve swap
        } catch {
            return false; // Curve swap failed, fallback to Uniswap
        }
    }

    function bidWithToken(address bidToken, uint256 amount) external {
        if (bidToken != token) {
            // Attempt to use Curve for swapping
            if (useCurveDEX(bidToken, amount)) {
                return; // Successful Curve swap
            }

            // Fallback to UniSwap if Curve swap fails or is not applicable
            IERC20Upgradeable(bidToken).approve(uniswapRouter, amount);

            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: bidToken,
                tokenOut: token,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

            uint256 swappedAmount = ISwapRouter(uniswapRouter).exactInputSingle(params);

            // Call the bid() function with the swapped amount in the main token
            bid(swappedAmount);
        } else {
            // If the token is the main token, directly bid
            bid(amount);
        }
    }

    function bid(uint256 amount) public {
        if (amount < currentPrice) {
            revert BidTooSmall();
        }

        if (currentPrice+priceIncrease.amount < amount) {
            if (!priceIncrease.canBidAboveIncrease) {
                revert CannotBidAboveCurrentPrice();
            }
            currentPrice = amount;
        }

        if (bids.length % priceIncrease.numBids == 0) {
            currentPrice += priceIncrease.amount;
        }

        _charge(msg.sender, amount);
        _bid(msg.sender, amount, false);
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

        for (uint32 i = winningSmallestIndex; i < l; ++i) {
            if (bids[i].offchain && bids[i].bidder == bidder) {
                revert("NotWinning");
            }

            done = _refundIfBidder(i, bidder); // send money back
            if (done) {
                index = i;
                break;
            }
        }

        if (done) {
            for (uint32 i = index; i < l - 1; ++i) {
                bids[i] = bids[i + 1];
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

        // Perform sinking logic to place the bid correctly
        uint32 j = uint32(bids.length) - 1;
        for (uint32 i = j - 1; i >= winningSmallestIndex && i < j; --i) {
            if (bids[j].amount <= bids[i].amount) {
                break; // Stop sinking when the new bid is smaller or equal
            }
            BidStruct memory temp = bids[i];
            bids[i] = bids[j];
            bids[j] = temp;
            winningBidIndex[bids[i].bidder].bidIndex = i;
            winningBidIndex[bids[j].bidder].bidIndex = j;
            j = i;
        }
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

    function getData() external view returns(
        address,    // token
        uint64,     // endTime
        uint256     // nextPrice
    ) {
        return (token, endTime, currentPrice+priceIncrease.amount);
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

        // Add the new bid to the end of the array
        bids.push(BidStruct(bidder, offchain, amount));
        winningBidIndex[bidder].bidIndex = uint32(bids.length) - 1;

        // Refund the smallest bid if the max winners are exceeded
        if (bids.length > maxWinners) {
            _refundBid(winningSmallestIndex);
            winningSmallestIndex++;
        }

        if (bids.length > type(uint32).max) {
            revert MaximumBidsAmountExceeded();
        }

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
