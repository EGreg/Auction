//
//http://127.0.0.1:8080/user.html?address=0xe1C8EEb9ABaF628D8a5620d9f1158bff5007e018&chainid=0x89
import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
import { switchNetwork, togglePopup } from "/js/common.js";

const countdownTime = 0; // 10 minutes in seconds
const countdownTimer = document.getElementById("countdownTimer");
const $bidPopup = document.getElementById("bidPopup");
const $nftSendPopup = document.getElementById("nftSendPopup");

function updateTimer(remainingTime) {
  const days = Math.floor(remainingTime / (24 * 60 * 60));
  const hours = Math.floor((remainingTime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((remainingTime % (60 * 60)) / 60);
  const seconds = remainingTime % 60;

  countdownTimer.textContent = `${days > 0 ? days + "d " : ""}${String(hours).padStart(2, "0")}h:${String(minutes).padStart(2, "0")}m:${String(seconds).padStart(2, "0")}s`;
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

async function ownerOf(contractAddress, chainid) {
  console.log('ownerOf(contractAddress, chainid)');
  console.log(contractAddress);
  console.log(chainid);
  const options = {
    chain: chainid, // Или другая сеть, например "bsc"
    address: contractAddress, // Адрес контракта
    functionName: "owner", // Метод, который вернёт владельца
    abi: [ // ABI контракта (только для нужного метода)
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          { "internalType": "address", "name": "", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ]
  };
  
  const ret = await Moralis.EvmApi.utils.runContractFunction(options);
  return ret.jsonResponse;
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

        var owner = await ownerOf(address, chainid);
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        var $gallery = $('.gallery');

        console.log(resp);
        // console.log(resp.status);
        console.log(resp.result);
        for (const item of resp.result) {
            var $img = $('<img>');
            $img
            .addClass('canBeTransferredByOwner')
            .attr('chainid', chainid)
            .attr('nftContract', item['token_address'])
            .attr('token_id', item['token_id'])
            ;

            if (item['metadata']) {
                try {
                    var iitem = JSON.parse(item['metadata']);
                    $gallery.append(
                      $img.attr('src', iitem['image'])
                    );
                } catch (error) {
                    console.error('cant json parse metadata:', error);
                }
            } else {
                
                $gallery.append(
                  $img.attr('src', 'https://picsum.photos/200')
                    
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
            
            if (owner && signer.address && owner.toLowerCase() == (signer.address).toLowerCase()) {
              $img.css('cursor', 'pointer');
              $img.off('click').on('click', function(e){
                
                e.preventDefault();  //prevent form from submitting
                togglePopup($nftSendPopup, true);
            
                $('#nfttransfer')  
                .attr('chainid', $(this).attr('chainid'))
                .attr('nftContract', $(this).attr('nftContract'))
                .attr('token_id', $(this).attr('token_id'))
            

              })
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
        
        if (response.raw)  {
            tokentoPay = response.raw[0];
            let currentTime = Math.floor(Date.now()/1000);
            remainingTime = response.raw[1]>currentTime ? response.raw[1] - currentTime : 0;
            $('#openPopup').html(
              'Bid $<span>'+ethers.formatEther(response.raw[2])+'</span>+'
            );
        } else {
            console.error('empty responce');    
        }
      } catch (error) {
        console.error('Error calling contract method:', error);
      }
}

async function fillBidsList(address, chainid) {
  
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
          var $bidders = $('.bidders');
          $bidders.html('');
          var i = 1;
          (response.raw).forEach(function(element){
            $bidders.append('<li><span>'+i+'</span><span>'+(element[0].substr(0,6) + '...'+element[0].substr(-6,6))+'</span><span>'+ethers.formatEther(element[2])+'</span><span>'+(element[1] ? 'off' : 'on') +'</span></li>');
            i++;
          })
        } else {
            $('ul.bidders').html('');
            $('ul.bidders').html('<li>There are no bids</li>');
        }
      } catch (error) {
        console.error('Error calling contract method:', error);
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
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Get the current chainId
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    
    const sender = accounts[0];
    
    return [
      chainId, // Returns chainId in hexadecimal format (e.g., "0x1" for Ethereum Mainnet)
      sender
    ]; 
  } catch (error) {
    console.error("Error getting chainId:", error.message);
  }
}

async function checkApprove(choosenchainid) {
  getChainId().then(function(ret){
    const [current_chainId, sender] = ret;

    var AuctionFactoryAddress = localStorage.getItem('AuctionFactoryAddress') || '0x1869069baca049d5c9f0433a37602962050dadee';

    const options = {
      chain: choosenchainid, // Blockchain (e.g., 'eth', 'bsc', 'polygon')
      address: tokentoPay, // Contract address
      functionName: 'allowance', // Function name in your contract
      abi: [ // Contract ABI
        {
          constant: true,
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ name: "", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      params: {
        owner: sender,
        spender:AuctionFactoryAddress
        //id: 1, // Parameters for the function (if any)
      },
    };

    // Call the contract method
    return Moralis.EvmApi.utils.runContractFunction(options);
  }).then(function(response){

      //0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
      if (response.raw == 0) {
        $('.approveToFactoryContainer').show();
      } else {
        $('.approveToFactoryContainer').hide();
      }
      
  }).catch(function(error){
    console.error('Error calling contract method:', error);

  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Get the current URL
  const url = window.location.href;

  // Create a URLSearchParams object
  const urlParams = new URLSearchParams(window.location.search);

  const address = urlParams.get('address');   // "25"

  $('.auctionCopyAddressContainer').html(address);

  if (address) {
      getChainId().then(function(ret){
        const [chainId, sender] = ret;
        $('.gallery').html('');
        ['0x1', '0x89', '0x38', '0x2105', '0xa'].forEach((element) => loadAndProcessData(address, element));
        //loadAndProcessData(address, chainid);
  
        fillBidsList(address, chainId);
        getAuctionData(address, chainId);
      })
      
  } else {
      $('body').html("missing GET parameter address");
  }

  
  document.getElementById("closePopup").addEventListener("click", () => togglePopup($bidPopup, false));
  document.getElementById("overlay").addEventListener("click", () => togglePopup($bidPopup, false));

  /* -------------------------- */
  $('#openPopup').off('click').on('click', function(e) { 
    e.preventDefault();  //prevent form from submitting
    togglePopup($bidPopup, true);
    $('#bidform-chainid').trigger('change')  ;
  });   
  $('#bidform-chainid').off('change').on('change', function(e) { 
    checkApprove($(this).val());
  });   

  $('.bid-form .placeYourBid').off('click').on('click', function(e) { 
      e.preventDefault();  //prevent form from submitting
      var $btn = $(this);

      try {
        $btn.attr('disabled', 'disabled');
        $btn.addClass('processing');
  
        var choosenchainid = $('#bidform-chainid').val();
        var amount = $('#bidform-amount').val();

        return callBidMethod(choosenchainid, amount).then(function(receipt){
          var internalVar;
          return getChainId().then(function(ret){
            const [chainId, sender] = ret;
            togglePopup($bidPopup, false);
            internalVar = chainId;
            return fillBidsList(address, chainId);
            
          }).then(function(){
            return getAuctionData(address, internalVar);
          })
          
  
        }).catch(function(error){
            console.error("An error occurred:", error);
            // On error: Reset button to initial state
            
        }).finally(function(){
          $btn.removeAttr('disabled');
          $btn.removeClass('processing');
        });
  
      
    
      } catch (error) {
        console.error('Error calling contract method:', error);
  
      };
  
  });   

  /* -------------------------- */
  
  document.getElementById("closePopupNFT").addEventListener("click", () => togglePopup($nftSendPopup, false));
  document.getElementById("overlay").addEventListener("click", () => togglePopup($nftSendPopup, false));
  
  $('#nfttransfer').off('click').on('click', function(e) { 
    
    e.preventDefault();  //prevent form from submitting
    var chainid     = $(this).attr('chainid');
    var nftContract = $(this).attr('nftContract');
    var token_id    = $(this).attr('token_id');
    var recipient   = $('#nftSendform_newOwner').val();
    console.log(chainid,nftContract,token_id,recipient);

    var $btn = $(this);
    
    //switchNetwork(chainid);

    try {
      $btn.attr('disabled', 'disabled');
      $btn.addClass('processing');

      
      callNFTTransferMethod(chainid, nftContract, token_id, recipient).then(function(receipt){
          
        // On success: Disable button permanently and keep it gray
        $btn.removeClass('processing');
          
        //$('.approveToFactoryContainer').hide();
        togglePopup($nftSendPopup, false)

      }).catch(function(error){
          console.error("An error occurred:", error);
      
          // On error: Reset button to initial state
          $btn.removeAttr('disabled');
          $btn.removeClass('processing');
      });

    
  
    } catch (error) {
      console.error('Error calling contract method:', error);

    };
  }); 
  
  async function callNFTTransferMethod(chainid, nftContract, token_id, recipient) {
    if (!window.ethereum) {
          throw new Error("MetaMask is not installed!");
    }
    
    //await switchNetwork(chainId);
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const abi= [ // Contract ABI
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "nftContract",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "tokenId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          }
        ],
        "name": "NFTtransfer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
    ];
    
    
    const contract = new ethers.Contract(address, abi, signer);
    const txResponse = await contract.NFTtransfer(nftContract, token_id, recipient);
    const txReceipt = await txResponse.wait();

    return txReceipt;         
  }

  async function callApproveMethod() {
    if (!window.ethereum) {
          throw new Error("MetaMask is not installed!");
    }
    
    //await switchNetwork(chainId);
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const abi= [ // Contract ABI
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
    ];
    
    var AuctionFactoryAddress = localStorage.getItem('AuctionFactoryAddress') || '0x1869069baca049d5c9f0433a37602962050dadee';
    const contract = new ethers.Contract(tokentoPay, abi, signer);
    const txResponse = await contract.approve(AuctionFactoryAddress,'0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    const txReceipt = await txResponse.wait();

    return txReceipt;         
  }

  async function callBidMethod(choosenchainid, amount) {
    
      switchNetwork(choosenchainid);
      //var AuctionFactoryAddress = localStorage.getItem('AuctionFactoryAddress') || '0x1869069baca049d5c9f0433a37602962050dadee';
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const abi =[ // Contract ABI
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            }
          ],
          "name": "bid",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
      ];
      
      const contract = new ethers.Contract(address, abi, signer);
      const txResponse = await contract.bid(ethers.parseUnits(amount,"ether"));
      const txReceipt = await txResponse.wait();
      return txReceipt;         
  }

  $('#approveToFactory').off('click').on('click', async function(e) {
    e.preventDefault();  //prevent form from submitting

    var $btn = $(this);
    
    //switchNetwork(chainid);

    try {
      $btn.attr('disabled', 'disabled');
      $btn.addClass('processing');

      
      callApproveMethod().then(function(receipt){
          
        // On success: Disable button permanently and keep it gray
        $btn.removeClass('processing');
          
        $('.approveToFactoryContainer').hide();

      }).catch(function(error){
          console.error("An error occurred:", error);
      
          // On error: Reset button to initial state
          $btn.removeAttr('disabled');
          $btn.removeClass('processing');
      });

    
  
    } catch (error) {
      console.error('Error calling contract method:', error);

    };

  });   
});