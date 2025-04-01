import { useState, useEffect} from 'react'
import {ethers} from 'ethers';
import {abi} from './artifacts/contracts/CompanyShares.sol/CompanyShares.json';

function App() {
  const [installed, setInstalled] = useState(false);
  const [account, setAccount] = useState(null);
  const [appState, setAppState] = useState({
    provider: null,
    signer: null,
    contract: null
  });
  const [shareCount, setSharesCount] = useState(0);
  const [toBuy, setToBuy] = useState(0);
  const [toSell, setToSell] = useState(0);
  const [bids, setBids] = useState([]);
  const [placedBid, setPlacedBid] = useState({requestId: null, amount: null});
  const [buyer, setBuyer] = useState({requestId: 0, addr: ""});
  const [trade, setTrade] = useState({id: 0, amount: 0});

  useEffect(()=>{
    async function getMetaMaskAccount(){
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      window.ethereum.on("accountsChanged", ()=> window.location.reload());

      setAccount(accounts[0]);
      // In order to create the contract instance we need to create a web3 provider and tx signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

      // Now using provider, signer, abi array, contract address we create the instance and call other fn
      const contractInstance = new ethers.Contract(addr,abi,signer);
      setAppState({provider, signer, contract: contractInstance});
    }
    if(window.ethereum){
      setInstalled(true);
      getMetaMaskAccount();
    }
  },[]);

  async function getShares(){
    if(appState.contract){
      const data = await appState.contract.getSharesOwned();
      setSharesCount(data);
    }
  }

  async function buyHandler(){
    if(toBuy < 1 || toBuy > 5) return alert("Allowed share - 1 -> 5");
    try {
      // Need to call the contract's buy share function here
      const value = ethers.parseEther(toBuy.toString());
      const txn = await appState.contract.buyShares(toBuy, {value: value});
      const txnData = await txn.wait();
      console.log("txn res", txnData);
      alert("Shares bought successfully");
    } catch (error) {
      alert(error.reason)
    }
  }

  function changeHandler(event){
    if(event.target.value < 1 || event.target.value > 5) alert("Allowed share - 1 -> 5");
    else setToBuy(event.target.value);
  }

  function sellChangeHandler(event){
    if(event.target.value > shareCount || event.target.value < 1) {
      alert("Insufficient share amount entered!");
      setToSell(0);
      return;
    }
    setToSell(event.target.value);
  }

  async function sellHandler(){
    if(toSell > shareCount) return alert('Insufficient share amount entered!');
    else {
      // the contract call is needed here
      try {
        const txn = await appState.contract.createSellRequest(Number(toSell));
        const data = await txn.wait();
        console.log(data);
        alert("Sell request placed successfully!!");
      } catch (error) {
        alert(error.reason);
      }
      
    }
  }

  async function showBids(){
    const data = await appState.contract.getMyRequest();
    setBids(data);
  }

  function bidChangeHandler(event){
    setPlacedBid({...placedBid, amount: event.target.value});
  }

  function requestChangeHandler(){
    setPlacedBid({...placedBid, requestId: event.target.value});
  }

  async function sendBid() {
    try {
      const txn = await appState.contract.placeBid(placedBid.requestId, placedBid.amount);
      txn.wait();
    } catch (error) {
      alert(error.reason);
    }
  }

  function buyerChangeHandler(event){
    setBuyer({...buyer, addr: event.target.value});
  }

  function buyerRequestChangeHandler(event){
    setBuyer({...buyer, requestId: event.target.value});
  }

  async function confirmBuyer(){
    // verify if the buyer address exist
    const index = bids.findIndex(bid=> bid[0] === buyer.addr);
    if(index < 0){
      alert("Invalid buyer address");
      return;
    }
    try {
      const txn = await appState.contract.finalizeSale(buyer.requestId, buyer.addr);
      await txn.wait();
      alert("Buyer confirmed. Wait for buyer to pay.")
    } catch (error) {
      alert(error.reason);
    }
  }

  function tradeIdHandler(event){
    setTrade({...trade, id: event.target.value});
  }

  function tradeAmountHandler(event){
    setTrade({...trade, amount: event.target.value});
  }

  async function PayForTrade(){
    // first convert this amount in wei
    const tradeAmount = ethers.parseEther(trade.amount.toString());
    const value = {value: tradeAmount};

    try {
      const txn = await appState.contract.payForTrade(trade.id, value);
      await txn.wait();
      alert('Payment was successful');
    } catch (error) {
      alert(error.reason);
    }
  }


  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-900 text-white rounded-xl shadow-lg mt-5">
    <h1 className="text-2xl font-bold text-center mb-4">Buy Shares as Fungible Tokens</h1>
    <p className="text-center text-sm mb-4">{installed ? "✅ Metamask Installed" : "❌ Metamask Not Installed"}</p>
    <p className="text-center text-lg font-medium mb-4">{account ? `Connected: ${account}` : "Not Connected"}</p>
    
    <div className="flex flex-col items-center space-y-4">
      <div className="flex space-x-2">
        <input type='number' onChange={changeHandler} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600" placeholder="Buy Shares"/>
        <button onClick={buyHandler} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg">Buy Shares</button>
      </div>

      <button onClick={getShares} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg">Load Shares</button>
      <p className="text-lg">Shares Owned: {shareCount} <button onClick={getShares} className="ml-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">🔄</button></p>
    
      <div className="flex space-x-2">
        <input type='number' onChange={sellChangeHandler} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600" placeholder="Sell Shares"/>
        <button onClick={sellHandler} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">Sell Shares</button>
      </div>
    
      <button onClick={showBids} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg">Show Bids</button>
    
      {bids.length > 0 && (
        <ul className="w-full bg-gray-800 p-4 rounded-lg space-y-2">
          {bids.map((bid, index) => (
            <li key={`k-${index}`} className="border-b border-gray-600 py-2">
              🏦 {bid[0]} | 💰 {bid[1]} ETH | {bid[2] ? "✅ Confirmed" : "⏳ Pending"}
            </li>
          ))}
        </ul>
      )}
    
      <div className="flex space-x-2">
        <input type='number' value={placedBid.amount} onChange={bidChangeHandler} placeholder='Amount' className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600"/>
        <input type='number' value={placedBid.requestId} onChange={requestChangeHandler} placeholder='Request ID' className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600"/>
        <button onClick={sendBid} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg">Send Bid</button>
      </div>
    
      <div className="flex space-x-2">
        <input type='text' onChange={buyerChangeHandler} placeholder='Bidder Address' className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600"/>
        <input type='number' onChange={buyerRequestChangeHandler} placeholder='Request ID' className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600"/>
        <button onClick={confirmBuyer} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg">Confirm Buyer</button>
      </div>
    
      <h3 className="text-lg font-semibold mt-4">Pay for the Trade</h3>
      <div className="flex space-x-2">
        <input type='number' onChange={tradeIdHandler} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600" placeholder="Trade ID"/> 
        <input type='number' onChange={tradeAmountHandler} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600" placeholder="Amount"/>
        <button onClick={PayForTrade} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg">Pay</button>
      </div>
    </div>
  </div>
  )
}

export default App
