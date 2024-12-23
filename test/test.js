const { ethers} = require('hardhat');
const { expect } = require('chai');
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

require("@nomicfoundation/hardhat-chai-matchers");
async function toBeDeveloped() {
  expect(1n).to.be.equal(2n);
}
describe("Tests", function () {
  //it("can’t refund() an offchain bid", toBeDeveloped);
  //it("should refund for lowest winner when owner do NFTClaim", toBeDeveloped);

  it("stub", async() => {


    expect(1n).to.be.equal(1n);
    
  });

});
