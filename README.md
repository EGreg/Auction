
# Cross-chain Auction

## Description

The **Cross-chain Auction** project is a platform for cross-chain auctions. The main idea is to create a single smart contract that allows users to participate in auctions across multiple blockchains.

Features:
- Create auctions via smart contracts.
- Support for interaction across multiple blockchains.
- Automatic bid management and synchronization of data between networks.

## Technologies

- **Solidity**: smart contract implementation.
- **Hardhat**: toolkit for testing and deploying contracts.
- **HTML, CSS, JavaScript (Ethers.js)**: for the frontend.

## Installation

### Steps to Install
1. Clone the repository:
   ```bash
   git clone https://github.com/artman325/Auction.git
   cd Auction
   ```
2. Install Hardhat dependencies:
   ```bash
   npm install
   ```

3. Set up a local HTTP server to serve the HTML files. For example:
   ```bash
   npx http-server .
   ```

## Usage

### Page Structure:
1. **produce.html**:
   - Form to create an auction. Users can specify parameters such as:
     - Token address (`token`).
     - Number of winners.
     - Time settings (`startTime`, `endTime`).
     - Starting price (`startingPrice`) and price increment step.

2. **produce.js**:
   - Script for blockchain interaction. Includes:
     - MetaMask integration.
     - Network switching and contract calls.
     - User interface management.

### Auction Workflow:
- After creating an auction via **produce.html**, the auction data is synchronized across blockchains.
- Users can place bids on any supported blockchain.
- Once the auction ends, winners can claim their NFTs using the corresponding buttons in the interface.

## Key Files

- `Auction.sol`: main auction contract.
- `AuctionFactory.sol`: factory contract for creating new auctions.
- `IAuction.sol`, `IAuctionFactory.sol`: interfaces for the contracts.
- `produce.html`, `produce.js`: user interaction interface.

## Contribution

The project is under development. You can suggest improvements by opening a pull request.

## License

The project is free and open-source.
