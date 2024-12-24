
export function togglePopup(popup, show) {
      
    const overlay = document.getElementById("overlay");
    const displayValue = show ? "block" : "none";

    popup.style.display = displayValue;
    overlay.style.display = displayValue;
}

export async function switchNetwork(chainId) {
    try {
        if (!window.ethereum) {
          throw new Error("MetaMask is not installed!");
        }
    
        //const provider = new ethers.BrowserProvider(window.ethereum);
        const hexChainId = 
            (typeof(chainId) == 'string') 
            ? 
                chainId.startsWith('0x') ? chainId : `0x${chainId.toString(16)}`
            :
            `0x${chainId.toString(16)}`
            ;
    
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: hexChainId }],
            });
            console.log(`Switched to chain ID: ${chainId}`);
        } catch (switchError) {
            if (switchError.code === 4902) {
                console.log(`Chain ID ${chainId} not found. Attempting to add it...`);
                await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                    chainId: hexChainId,
                    chainName: "Your Network Name", // Replace with your network name
                    rpcUrls: ["https://your-rpc-url"], // Replace with your RPC URL
                    nativeCurrency: {
                        name: "Your Token Name", // e.g., "Ethereum"
                        symbol: "Your Token Symbol", // e.g., "ETH"
                        decimals: 18,
                    },
                    blockExplorerUrls: ["https://your-block-explorer"], // Replace with your block explorer URL
                    },
                ],
                });
                console.log(`Added and switched to chain ID: ${chainId}`);
            } else {
                throw switchError;
            }
        }
    
    } catch (error) {
        console.error("Error:", error.message || error);
    }
};
