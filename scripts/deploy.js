
async function main() {
	
    var signers = await ethers.getSigners();
    const provider = ethers.provider;
    var deployer= signers[0];
        
	console.log(
		"Deploying contracts with the account:",
		deployer.address
	);

	var options = {
	// 	//gasPrice: ethers.utils.parseUnits('50', 'gwei'), 
	// 	gasLimit: 10e6
	};

    const deployerBalanceBefore = await provider.getBalance(deployer.address);
    console.log("Account balance:", (deployerBalanceBefore).toString());

	const AuctionF = await ethers.getContractFactory("Auction");

	let implementationAuction = await AuctionF.connect(deployer).deploy();

    await implementationAuction.waitForDeployment();

	console.log("Implementations:");
	console.log("  implementationAuction deployed at:               ", implementationAuction.target);
    let _params = [
		implementationAuction.target
	]
	let params = [
		..._params,
		options
	]

	const AuctionFactoryF = await ethers.getContractFactory("AuctionFactory");

	var auctionFactory = await AuctionFactoryF.connect(deployer).deploy(...params);

	await auctionFactory.waitForDeployment();

	console.log("Factory deployed at:", auctionFactory.target);
	console.log("with params:", [..._params]);

	const deployerBalanceAfter = await provider.getBalance(deployer.address);
	console.log("Spent:", ethers.formatEther(deployerBalanceBefore - deployerBalanceAfter));
	console.log("gasPrice:", ethers.formatUnits((await network.provider.send("eth_gasPrice")), "gwei")," gwei");


    console.log('verifying');
    if (hre.network.name == 'hardhat') {
        console.log('skip for forks');
    } else {
        await hre.run("verify:verify", {address: implementationAuction.target, constructorArguments: []});
        await hre.run("verify:verify", {address: auctionFactory.target, constructorArguments: _params});
    }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
	console.error(error);
	process.exit(1);
  });