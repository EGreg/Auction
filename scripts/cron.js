const Moralis = require('moralis').default;
const { ethers } = require('ethers');

// Configuration: List of chains and factory addresses
const chains = {
  chainA: { chainId: '0x1', factoryAddress: '0x1869069bACa049D5C9f0433a37602962050dAdee' },
  chainB: { chainId: '0x89', factoryAddress: '0x1869069bACa049D5C9f0433a37602962050dAdee' },
  chainC: { chainId: '0x38', factoryAddress: '0x1869069bACa049D5C9f0433a37602962050dAdee' },
  chainD: { chainId: '0x2105', factoryAddress: '0x1869069bACa049D5C9f0433a37602962050dAdee' },
  chainD: { chainId: '0xa', factoryAddress: '0x1869069bACa049D5C9f0433a37602962050dAdee' },
};

const bidListeners = {};
const factoryListeners = {};

// Initialize Moralis
async function initializeMoralis() {
  await Moralis.start({ apiKey: process.env.MORALIS_API_KEY });
  console.log('Moralis initialized');
}

// Start listening for "Bid" events on a specific contract
async function startListening(chainId, address) {
  console.log(`Starting to listen for "Bid" events on ${address} on chain ${chainId}`);
  
  const topic = ethers.utils.id('Bid(address,uint256)');
  const listener = async (event) => {
    const decoded = ethers.utils.defaultAbiCoder.decode(['address', 'uint256'], event.data);
    const [bidder, amount] = decoded;

    console.log(`Bid event on ${address} (chain ${chainId}):`, { bidder, amount });

    // Call bidOffchain on other chains
    for (const [key, chain] of Object.entries(chains)) {
      if (chain.chainId !== chainId) {
        await bidOffchain(chain.chainId, bidder, amount);
      }
    }
  };

  const subscription = Moralis.Streams.add({
    chains: [chainId],
    address,
    topic,
    callback: listener,
  });

  bidListeners[address] = subscription;
}

// Stop listening for "Bid" events on a specific contract
async function stopListening(chainId, address) {
  console.log(`Stopping listening for "Bid" events on ${address} on chain ${chainId}`);
  
  const subscription = bidListeners[address];
  if (subscription) {
    await Moralis.Streams.delete(subscription);
    delete bidListeners[address];
  }
}

// Listen for "Produce" events on factory contracts
async function listenToFactory(chainId, factoryAddress) {
  console.log(`Listening for "Produce" events on factory ${factoryAddress} on chain ${chainId}`);
  
  const topic = ethers.utils.id('Produce(address)');
  const listener = async (event) => {
    const decoded = ethers.utils.defaultAbiCoder.decode(['address'], event.data);
    const [newAddress] = decoded;

    console.log(`Produce event on factory ${factoryAddress} (chain ${chainId}):`, { newAddress });

    // Start listening for Bid events on the new address
    await startListening(chainId, newAddress);
  };

  const subscription = Moralis.Streams.add({
    chains: [chainId],
    address: factoryAddress,
    topic,
    callback: listener,
  });

  factoryListeners[factoryAddress] = subscription;
}

// Stop listening for factory events
async function stopListeningToFactory(chainId, factoryAddress) {
  console.log(`Stopping listening for "Produce" events on factory ${factoryAddress} on chain ${chainId}`);
  
  const subscription = factoryListeners[factoryAddress];
  if (subscription) {
    await Moralis.Streams.delete(subscription);
    delete factoryListeners[factoryAddress];
  }
}

// Call bidOffchain on other chains
async function bidOffchain(chainId, address, amount) {
  console.log(`Calling bidOffchain on chain ${chainId}:`, { address, amount });
  // Implement your offchain logic here
}

// Startup logic: Start listening to all factory contracts
async function startup() {
  await initializeMoralis();

  for (const [key, chain] of Object.entries(chains)) {
    await listenToFactory(chain.chainId, chain.factoryAddress);
  }
}

// Start the script
startup().catch(console.error);

module.exports = {
  startListening,
  stopListening,
  listenToFactory,
  stopListeningToFactory,
};
