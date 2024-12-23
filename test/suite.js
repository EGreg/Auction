const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction Contract", function () {
  let Auction, auction, owner, addr1, addr2;

  beforeEach(async () => {
    Auction = await ethers.getContractFactory("Auction");
    [owner, addr1, addr2] = await ethers.getSigners();
    auction = await Auction.deploy();

    await auction.initialize(
      ethers.ZeroAddress, // token address
      true, // cancelable
      Math.floor(Date.now() / 1000), // start time
      Math.floor(Date.now() / 1000) + 3600, // end time
      3600, // claim period
      5, // max winners
      10, // winner claim interval
      1, // starting price
      { amount: 1, numBids: 2, canBidAboveIncrease: true } // price increase
    );
  });

  describe("bid()", function () {
    it("should allow a valid on-chain bid", async () => {
      const bidAmount = ethers.parseEther("1");
      await auction.connect(addr1).bid({ value: bidAmount });

      const bids = await auction.winning();
      expect(bids.length).to.equal(1);
      expect(bids[0].bidder).to.equal(addr1.address);
    });

    it("should revert if bid is below current price", async () => {
      const bidAmount = ethers.parseEther("0.5");
      await expect(
        auction.connect(addr1).bid({ value: bidAmount })
      ).to.be.revertedWith("BidTooSmall");
    });

    it("should update current price after multiple bids", async () => {
      const bidAmount1 = ethers.parseEther("1");
      const bidAmount2 = ethers.parseEther("2");

      await auction.connect(addr1).bid({ value: bidAmount1 });
      await auction.connect(addr2).bid({ value: bidAmount2 });

      const currentPrice = await auction.currentPrice();
      expect(currentPrice).to.equal(ethers.parseEther("3"));
    });
  });

  describe("bidOffchain()", function () {
    it("should allow adding off-chain bids", async () => {
      await auction.connect(owner).bidOffchain(addr1.address, ethers.parseEther("2"));
      const bids = await auction.winning();
      expect(bids.length).to.equal(1);
      expect(bids[0].bidder).to.equal(addr1.address);
    });

    it("should correctly position off-chain bids using sinking logic", async () => {
      await auction.connect(owner).bidOffchain(addr1.address, ethers.parseEther("2"));
      await auction.connect(owner).bidOffchain(addr2.address, ethers.parseEther("3"));

      const bids = await auction.winning();
      expect(bids[0].bidder).to.equal(addr2.address); // Higher bid
      expect(bids[1].bidder).to.equal(addr1.address); // Lower bid
    });

    it("should not enforce current price rules for off-chain bids", async () => {
      await auction.connect(owner).bidOffchain(addr1.address, ethers.parseEther("0.5"));
      const bids = await auction.winning();
      expect(bids[0].bidder).to.equal(addr1.address);
    });
  });

  describe("Refunds and Max Winners", function () {
    it("should refund the smallest bid when max winners is exceeded", async () => {
      for (let i = 0; i < 6; i++) {
        const bidder = i % 2 === 0 ? addr1 : addr2;
        await auction.connect(owner).bidOffchain(bidder.address, ethers.parseEther((i + 1).toString()));
      }

      const bids = await auction.winning();
      expect(bids.length).to.equal(5); // Only max winners are retained
    });
  });

  describe("Events", function () {
    it("should emit Bid event on successful bid()", async () => {
      await expect(auction.connect(addr1).bid({ value: ethers.parseEther("1") }))
        .to.emit(auction, "Bid")
        .withArgs(addr1.address, ethers.parseEther("1"), 1);
    });

    it("should emit Bid event on successful bidOffchain()", async () => {
      await expect(auction.connect(owner).bidOffchain(addr1.address, ethers.parseEther("2")))
        .to.emit(auction, "Bid")
        .withArgs(addr1.address, ethers.parseEther("2"), 1);
    });
  });
});
