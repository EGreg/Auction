// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.18;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IAuctionFactory.sol";

//import "hardhat/console.sol";
contract AuctionFactory is IAuctionFactory {
    using Clones for address;
    using Address for address;
    
    function doCharge(
        address targetToken, 
        uint256 amount, 
        address from, 
        address to
    ) 
        external 
        returns(bool returnSuccess) 
    {
        returnSuccess = true;
    }
}