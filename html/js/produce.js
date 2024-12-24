import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";

var salt;
var lastTs;

async function switchNetwork(chainId) {
    try {
        if (!window.ethereum) {
          throw new Error("MetaMask is not installed!");
        }
    
        //const provider = new ethers.BrowserProvider(window.ethereum);
        const hexChainId = `0x${chainId.toString(16)}`;
    
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

async function callProduceMethod(chainId,salt) {

    if (!window.ethereum) {
      throw new Error("MetaMask is not installed!");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const hexChainId = `0x${chainId.toString(16)}`;

    await switchNetwork(chainId);

    const signer = await provider.getSigner();
    
    const CONTRACT_ABI = [
        {
        "inputs": [
            {
            "internalType": "bytes32",
            "name": "salt",
            "type": "bytes32"
            },
            {
            "internalType": "address",
            "name": "token",
            "type": "address"
            },
            {
            "internalType": "bool",
            "name": "cancelable",
            "type": "bool"
            },
            {
            "internalType": "uint64",
            "name": "startTime",
            "type": "uint64"
            },
            {
            "internalType": "uint64",
            "name": "endTime",
            "type": "uint64"
            },
            {
            "internalType": "uint64",
            "name": "claimPeriod",
            "type": "uint64"
            },
            {
            "internalType": "uint32",
            "name": "maxWinners",
            "type": "uint32"
            },
            {
            "internalType": "uint32",
            "name": "winnerClaimInterval",
            "type": "uint32"
            },
            {
            "internalType": "uint256",
            "name": "startingPrice",
            "type": "uint256"
            },
            {
            "components": [
                {
                "internalType": "uint128",
                "name": "amount",
                "type": "uint128"
                },
                {
                "internalType": "uint32",
                "name": "numBids",
                "type": "uint32"
                },
                {
                "internalType": "bool",
                "name": "canBidAboveIncrease",
                "type": "bool"
                }
            ],
            "internalType": "struct IAuction.Increase",
            "name": "increase",
            "type": "tuple"
            }
        ],
        "name": "produceDeterministic",
        "outputs": [
            {
            "internalType": "address",
            "name": "instance",
            "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
        },
    ];

    var formdata = $("#ProduceForm :input , #ProduceForm select").serializeArray();
    var data = {};
    $(formdata ).each(function(index, obj){ data[obj.name] = obj.value; })
    var params = [];
    /*
        bytes32 salt,
        address token,
        bool cancelable,
        uint64 startTime,
        uint64 endTime,
        uint64 claimPeriod,
        uint32 maxWinners,
        uint32 winnerClaimInterval,
        uint256 startingPrice,
        IAuction.Increase memory increase
    */
    params.push(salt);
    params.push(data.token);
    params.push(typeof(data.cancelable !== 'undefined') && data.cancelable == 'on' ? true : false);
    params.push(Date.parse(data.startTime)/1000);
    params.push(Date.parse(data.endTime)/1000);
    params.push(data.claimPeriod == 'custom' ? $('#claimPeriod_custom').val() : data.claimPeriod);
    params.push(data.maxWinners);
    params.push(data.winnerClaimInterval == 'custom' ? $('#winnerClaimInterval_custom').val() : data.winnerClaimInterval);
    params.push(ethers.parseUnits(data.startingPrice, "ether"));
    params.push({
        amount: ethers.parseUnits(data.increase_amount, "ether"),
        numBids: data.increase_numBids,
        canBidAboveIncrease: typeof(data.canBidAboveIncrease !== 'undefined') && data.canBidAboveIncrease == 'on' ? true : false
    });
    
    const contract = new ethers.Contract(AuctionFactoryAddress, CONTRACT_ABI, signer);
    const txResponse = await contract.produceDeterministic(...params);
    const txReceipt = await txResponse.wait();
    
    var instanceAddress = "0x" + (txReceipt.logs[0].data).slice(26, 66);
    
    return instanceAddress;
    
};

//// Generate a 32-byte hash from the random bytes
function randomHash() {
    return ethers.keccak256(ethers.randomBytes(32));
}


// localStorage.setItem('AuctionFactoryAddress', '0x752d8a444121b3449d6cbb0A1235DfA12078b288'); // polygon
var AuctionFactoryAddress = localStorage.getItem('AuctionFactoryAddress');
if (AuctionFactoryAddress === null) {
    $('body').html(
    "need to setup 'AuctionFactoryAddress' key in localStorage"
    );
}

//------------------------------
$('form select.showCustomInput').off('change').on('change', function(e){
    e.preventDefault();
    var id = $(this).attr('id');
    var val = $(this).val();
    var $custom = $(this).parent().find('#'+id+'_custom');
    var customHidden = ($custom.css('display') == 'none') ? false : true;

    if (val == 'custom' && !customHidden) { $custom.show(); }
    if (val != 'custom' && customHidden) { $custom.hide(); }
});

$('.produce-auction-button').off('click').on('click', function(e) { 
    e.preventDefault();  //prevent form from submitting
    
    var $btn = $(this);
    var chainid = $btn.data('chainid');
    //switchNetwork(chainid);

    try {
        $btn.attr('disabled', 'disabled');
        $btn.addClass('processing');

        
        callProduceMethod(chainid, salt).then(function(instance){
            
            // On success: Disable button permanently and keep it gray
            $btn.removeClass('processing');
            $btn.css('background-color', 'gray'); // Make sure it stays gray

            //Then when transaction is mined, you retrieve from localStorage a JSON object, extend it and save it again. 
            // The object key could be “Assets.Auction.list” and you’d have an array all auctions (even ended ones), sorted by endTime probably. 
            // Put whatever info in each auction as is useful.

            // localStorage.setItem('AuctionFactoryAddress', '0x45DBdA62B098F67D54b2871D90dA6dFa43495bF1');
            var storageData = localStorage.getItem('Assets.Auction.list');
            if (storageData === null){
                storageData = {};
                storageData[lastTs] = {};
                storageData[lastTs]['salt'] = salt;
            } else  {
                storageData = JSON.parse(storageData);
            }

            if (typeof(storageData[lastTs]) === 'undefined') {
                storageData[lastTs] = {};
                storageData[lastTs]['salt'] = salt;
            }

            storageData[lastTs][chainid] = {
                chainid: chainid,
                address: instance
            };
            localStorage.setItem('Assets.Auction.list', JSON.stringify(storageData));
            $('.link-to-auction-page').html('Link to <a href="user.html?address='+instance+'">Auction Page</a>');

        }).catch(function(error){
            console.error("An error occurred:", error);
        
            // On error: Reset button to initial state
            $btn.removeAttr('disabled');
            $btn.removeClass('processing');
        })
            
        
        
    } catch (error) {
        console.error("An error occurred:", error);
    
        // On error: Reset button to initial state
        $btn.removeAttr('disabled');
        $btn.removeClass('processing');
    }
    
    //console.log('salt for this session is ', salt);
    
    // var data = $("#ProduceForm :input , #ProduceForm :select").serializeArray();
    // console.log(data); //use the console for debugging, F12 in Chrome, not alerts
});


// Added logic for overlay and popup handling

document.addEventListener("DOMContentLoaded", () => {
    salt = randomHash();
    lastTs = Date.now();

    const modal = document.getElementById("produceModal");
    const overlay = document.getElementById("overlay");
    const openButton = document.querySelector(".produce-auction-button-openpopup");
    const closeButton = modal.querySelector(".modal-close");

    function toggleModal(show) {
        if (!modal || !overlay) return;
        const displayValue = show ? "block" : "none";
        modal.style.display = displayValue;
        overlay.style.display = displayValue;
    }

    if (openButton) {
        openButton.addEventListener("click", () => toggleModal(true));
    } else {
        console.error("Button with class 'produce-auction-button-openpopup' not found.");
    }
    
    if (closeButton) {
        closeButton.addEventListener("click", () => toggleModal(false));
    } else {
        console.error("Button with class 'modal-close' not found.");
    }

    if (overlay) {
        overlay.addEventListener("click", () => toggleModal(false));
    } else {
        console.error("Overlay element not found.");
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

