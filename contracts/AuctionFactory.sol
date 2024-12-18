// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.18;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IAuctionFactory.sol";

//import "hardhat/console.sol";
contract AuctionFactory is IAuctionFactory, Ownable {
    using Clones for address;
    using Address for address;

    /**
    * @custom:shortd implementationAuction address
    * @notice implementationAuction address
    */
    address public immutable implementationAuction;

    address[] public instances;
    
    error InstanceCreatedFailed();
    error InvalidToken(address token);
    error InvalidTime();

    event InstanceCreated(address instance, uint instancesCount);
    
    constructor(address _implementation) 
    {
        implementationAuction = _implementation;
    }

    ////////////////////////////////////////////////////////////////////////
    // external section ////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    /**
    * @notice produce Auction instance
    * @param token address of erc20 token which using when user bid and charged by factory.
    * @param cancelable can Auction be cancelled or no
    * @param startTime auction start time
    * @param endTime auction end time
    * @param claimPeriod can't withdraw and nftTransfer before (endTime + claimPeriod)
    * @param startingPrice starting price 
    * @param increase increase tuple [amount, bidsCount, canBidAbove] how much will the price increase `amount` after `bidsCount` bids happens
    * @param maxWinners maximum winners
    * @param winnerClaimInterval winners can choose tokenid in claim method. 
    * Mean after endTime 1st winner can claim and choose token, after `winnerClaimInterval` 2nd winner can choose and so on
    * @param nft nft contract
    * @param tokenIds winners will obtain this tokenIds 
    * @return instance address of created instance `Auction`
    */
    function produce(
        address token,
        bool cancelable,
        uint64 startTime,
        uint64 endTime,
        uint64 claimPeriod,
        uint256 startingPrice,
        IAuction.Increase memory increase,
        uint32 maxWinners,
        uint32 winnerClaimInterval,
        address nft,
        uint256[] memory tokenIds
    ) 
        external 
        returns (address instance) 
    {
        address ms = _msgSender();
        instance = address(implementationAuction).clone();
        
        _beforeInit(instance);
        _validateParams(token, endTime);

        IAuction(instance).initialize(token, cancelable, startTime, endTime, claimPeriod, startingPrice, increase, maxWinners, winnerClaimInterval, nft, tokenIds);
        
        _afterInit(instance, ms);
    }

    /**
    * @notice produce deterministic(with salt) Auction instance
    * @param salt salt
    * @param token address of erc20 token which using when user bid and charged by factory.
    * @param cancelable can Auction be cancelled or no
    * @param startTime auction start time
    * @param endTime auction end time
    * @param claimPeriod can't withdraw and nftTransfer before (endTime + claimPeriod)
    * @param startingPrice starting price 
    * @param increase increase tuple [amount, bidsCount, canBidAbove] how much will the price increase `amount` after `bidsCount` bids happens
    * @param maxWinners maximum winners
    * @param winnerClaimInterval winners can choose tokenid in claim method. 
    * Mean after endTime 1st winner can claim and choose token, after `winnerClaimInterval` 2nd winner can choose and so on
    * @param nft nft contract
    * @param tokenIds winners will obtain this tokenIds 
    * @return instance address of created instance `Auction`
    */
    function produceDeterministic(
        bytes32 salt,
        address token,
        bool cancelable,
        uint64 startTime,
        uint64 endTime,
        uint64 claimPeriod,
        uint256 startingPrice,
        IAuction.Increase memory increase,
        uint32 maxWinners,
        uint32 winnerClaimInterval,
        address nft,
        uint256[] memory tokenIds
    ) 
        external 
        returns (address instance) 
    {
        address ms = _msgSender();
        instance = address(implementationAuction).cloneDeterministic(salt);
        _beforeInit(instance);
        _validateParams(token, endTime);
        
        IAuction(instance).initialize(token, cancelable, startTime, endTime, claimPeriod, startingPrice, increase, maxWinners, winnerClaimInterval, nft, tokenIds);
        _afterInit(instance, ms);
    }

    function doCharge(
        address targetToken, 
        uint256 amount, 
        address from, 
        address to
    ) 
        external 
        returns(bool returnSuccess) 
    {
        bytes memory data = abi.encodeWithSelector(IERC20(targetToken).transferFrom.selector, from, to, amount);
        // we shoud not revert transaction, just return failed condition of `transferFrom` attempt
        (bool success, bytes memory returndata) = address(targetToken).call{value: 0}(data);

        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(targetToken.isContract(), "Address: call to non-contract");
            }
            returnSuccess = true;
        } else {
            returnSuccess = false;
        }
    }

    ////////////////////////////////////////////////////////////////////////
    // internal section ////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    function _beforeInit(
        address instance
    )
        internal
    {

        if (instance == address(0)) {
            revert InstanceCreatedFailed();
        }
        instances.push(instance);
        emit InstanceCreated(instance, instances.length);

    }

    function _validateParams(
        address token,
        uint64 endTime
    )
        internal 
        view
    {
        if (!token.isContract()) {
            revert InvalidToken(token);
        }
        if (endTime <= block.timestamp) {
            revert InvalidTime();
        }

    }
    
    function _afterInit(address instance, address sender) internal {
        //-- transferownership to sender
        Ownable(instance).transferOwnership(sender);
        //-----------------
    }
}