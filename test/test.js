const { ethers} = require('hardhat');
const { expect } = require('chai');
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

require("@nomicfoundation/hardhat-chai-matchers");

describe("Tests", function () {
  
  it("stub", async() => {


    expect(1n).to.be.equal(1n);
    
  });

});
