//
//http://127.0.0.1:8080/user.html?address=0xe1C8EEb9ABaF628D8a5620d9f1158bff5007e018&chainid=0x89
import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
const countdownTime = 10 * 60; // 10 minutes in seconds
const countdownTimer = document.getElementById("countdownTimer");

function updateTimer(remainingTime) {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    countdownTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

let remainingTime = countdownTime;
const timerInterval = setInterval(() => {
    if (remainingTime > 0) {
        remainingTime--;
        updateTimer(remainingTime);
    } else {
        clearInterval(timerInterval);
    }
}, 1000);

async function fetchData(url, options) {
    try {
        const response = await fetch(url, options);
        console.log(response);
        if (!response.ok) {
            throw new Error(`error loading from ${url}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
    }
}

async function loadAndProcessData(address,chainid) {
    
    //const apiUrl = 'https://deep-index.moralis.io/api/v2.2/'+address+'/nft?format=decimal&media_items=true';
    const apiUrl = 'https://deep-index.moralis.io/api/v2.2/'+address+'/nft?chain='+chainid+'&format=decimal&media_items=true';
    //const apiUrl = 'https://deep-index.moralis.io/api/v2.2/0x769a584853D3edfFc6d74E46698523376EB9040D/nft?chain=eth&format=decimal&media_items=true';
    //const apiUrl = 'https://deep-index.moralis.io/api/v2.2/0x7811c6a535DDff8F86BFDEaDE882E744bc9FE380/nft?chain=eth&format=decimal&media_items=true';

    try {
        // Загружаем массив токенов
        var response = await window.Moralis.EvmApi.nft.getWalletNFTs( {
            chain: chainid, // Blockchain ('eth', 'bsc', 'polygon', etc.)
            address: address, // Wallet address
            limit: 100, // Number of NFTs to fetch per request (max is 100)
          });
        var resp = response.jsonResponse;
        if (resp.status != 'SYNCED') {
            console.warn("status is not 'SYNCED'");
        }
        
        var $gallery = $('.gallery');

        console.log(resp);
        // console.log(resp.status);
        // console.log(resp.result);
        for (const item of resp.result) {
            if (item['metadata']) {
                try {
                    var iitem = JSON.parse(item['metadata']);
                    $gallery.append(
                        $('<img>').attr('src', iitem['image'])
                    );
                    // {
                    //     "name":"",
                    //     "symbol":"",
                    //     "description":"",
                    //     "image":"",
                    //     "external_url":"",
                    //     "attributes":[]
                    // }
                } catch (error) {
                    console.error('cant json parse metadata:', error);
                }
            } else {
                
                $gallery.append(
                    $('<img>').attr('src', 'https://picsum.photos/200')
                );
            
                const response_sync = await Moralis.EvmApi.nft.reSyncMetadata({
                    "address": item['token_address'], // Адрес контракта NFT
                    "tokenId": item['token_id'], // ID токена
                    "mode": "async",
                    "chain": chainid, // Сеть, в которой развернут контракт (например, polygon, eth, bsc)
                    "flag": "metadata", // Указать, что нужно пересинхронизировать метаданные
                    });
                console.log("Metadata re-synced:", response_sync);

                console.log(' no metadata');
            }

        }

    } catch (error) {
        console.error('error when trying to load:', error);
    }
}
var tokentoPay;
async function getAuctionData(address, chainid) {
    const options = {
        chain: chainid, // Blockchain (e.g., 'eth', 'bsc', 'polygon')
        address: address, // Contract address
        functionName: 'getData', // Function name in your contract
        abi: [ // Contract ABI
            {
                "inputs": [],
                "name": "getData",
                "outputs": [
                  {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                  },
                  {
                    "internalType": "uint64",
                    "name": "",
                    "type": "uint64"
                  },
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
            },
        ],
        params: {
          //id: 1, // Parameters for the function (if any)
        },
      };

    try {
        
        // Call the contract method
        const response = await Moralis.EvmApi.utils.runContractFunction(options);
        console.log('Response:', response.raw); // Display the result
        console.log('Response:', response.raw[0]); // Display the result
        console.log('Response:', response.raw[1]); // Display the result
        console.log('Response:', response.raw[2]); // Display the result
        if (response.raw)  {
            tokentoPay = response.raw[0];
            let currentTime = Math.floor(Date.now()/1000);
            remainingTime = response.raw[1]>currentTime ? response.raw[1] - currentTime : 0;
            $('#openPopup').html(
              'Bid $<span>'+ethers.formatEther(response.raw[2])+'</span>+'
            );
            console.log('Bid $<span>'+ethers.formatEther(response.raw[2])+'</span>+');
        } else {
            console.error('Error !!!!!!!!!!!!!!!!!!!!!!!!');    
        }
      } catch (error) {
        console.error('Error calling contract method:', error);
      }
}

async function fillBidsList(address, chainid) {
    console.log(address);
    console.log(chainid);
    const options = {
        chain: chainid, // Blockchain (e.g., 'eth', 'bsc', 'polygon')
        address: address, // Contract address
        functionName: 'winning', // Function name in your contract
        abi: [ // Contract ABI
            {
                "inputs": [],
                "name": "winning",
                "outputs": [
                  {
                    "components": [
                      {
                        "internalType": "address",
                        "name": "bidder",
                        "type": "address"
                      },
                      {
                        "internalType": "bool",
                        "name": "offchain",
                        "type": "bool"
                      },
                      {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                      }
                    ],
                    "internalType": "struct IAuction.BidStruct[]",
                    "name": "result",
                    "type": "tuple[]"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ],
        params: {
          //id: 1, // Parameters for the function (if any)
        },
      };

    try {
        
        // Call the contract method
        const response = await Moralis.EvmApi.utils.runContractFunction(options);
        console.log('Response:', response.raw); // Display the result
        if (response.raw && response.raw.length > 0)  {

        } else {
            $('ul.bidders').html('');
            $('ul.bidders').html('<li>There are no bids</li>');
        }
      } catch (error) {
        console.error('Error calling contract method:', error);
      }
}

async function sendTransactionWithMetaMask(contractAddress, amount) {
  if (typeof window.ethereum === 'undefined') {
    console.error('MetaMask is not installed!');
    return;
  }

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const sender = accounts[0];

  try {
      const options = {
          chain: "polygon", // Replace with the target chain (e.g., "eth", "polygon", "bsc")
          address: "0xYourERC20ContractAddress", // Replace with the ERC-20 token contract address
          function_name: "bid", // ERC-20 transfer function
          abi: [
            {
              constant: false,
              inputs: [
                  {
                      name: "amount",
                      type: "uint256",
                  },
              ],
              name: "transferFrom",
              outputs: [
                {
                  name: "",
                  type: "bool",
                },
              ],
              payable: false,
              stateMutability: "nonpayable",
              type: "function",
            },
          ],
          params: {
            _to: "0xRecipientWalletAddress", // Address to which tokens are sent
            _value: Moralis.EvmApi.utils.toWei("10", 18), // Amount of tokens (convert to smallest unit)
          },
        };

    console.log('Transaction sent! Hash:', txHash);
  } catch (error) {
    console.error('Error sending transaction:', error);
  }
}
async function getChainId() {
  // Check if MetaMask (window.ethereum) is available
  if (typeof window.ethereum === "undefined") {
    console.error("MetaMask is not installed!");
    alert("Please install MetaMask to interact with this application.");
    return;
  }

  try {
    // Request connection to MetaMask (if not already connected)
    await window.ethereum.request({ method: "eth_requestAccounts" });

    // Get the current chainId
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    console.log("Current Chain ID:", chainId);

    return chainId; // Returns chainId in hexadecimal format (e.g., "0x1" for Ethereum Mainnet)
  } catch (error) {
    console.error("Error getting chainId:", error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Get the current URL
  const url = window.location.href;

  // Create a URLSearchParams object
  const urlParams = new URLSearchParams(window.location.search);

  const address = urlParams.get('address');   // "25"

  $('.auctionCopyAddressContainer').html(address);

  if (address) {
      getChainId().then(function(chainId){
        $('.gallery').html('');
        ['0x1', '0x89', '0x38', '0x2105', '0xa'].forEach((element) => loadAndProcessData(address, element));
        //loadAndProcessData(address, chainid);
  
        fillBidsList(address, chainId);
        getAuctionData(address, chainId);
      })
      
      
  } else {
      console.log('$(<body>).html("missing GET parameters address and chainid");');
      $('body').html("missing GET parameters address and chainid");
  }

  $('.bid-form .btn').off('click').on('click', function(e) { 
      e.preventDefault();  //prevent form from submitting
    alert('clicked');
      
  });   
  
  $('#approveForm .btn').off('click').on('click', async function(e) { 
    e.preventDefault();  //prevent form from submitting

    var AuctionFactoryAddress = localStorage.getItem('AuctionFactoryAddress');

    var amount = $('#approveAmount').val();

    if (typeof window.ethereum === 'undefined') {
      console.error('MetaMask is not installed!');
      return;
    }

    if (!amount) {
      console.error('invalid amount!');
      return;
    }
  
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const sender = accounts[0];

    try {
      const options = {
        chain: chainid, // Replace with the target chain (e.g., "eth", "polygon", "bsc")
        address: tokentoPay, // Replace with the ERC-20 token contract address
        function_name: "approve", // ERC-20 transfer function
        abi: [
          {
            "inputs": [
              {
                "internalType": "address",
                "name": "spender",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              }
            ],
            "name": "approve",
            "outputs": [
              {
                "internalType": "bool",
                "name": "",
                "type": "bool"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          },
        ],
        params: {
          spender: AuctionFactoryAddress, // Address to which tokens are sent
          amount: window.Moralis.EvmApi.utils.toWei(amount, 18), // Amount of tokens (convert to smallest unit)
        },
      };

      console.log('Transaction sent! Hash:', txHash);
    } catch (error) {
      console.error('Error sending transaction:', error);
    }

  });   
});