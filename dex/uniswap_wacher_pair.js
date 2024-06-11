// Polygon Only Currently
// 幣本位沒有兌美元的參照物所以
// 直接對應binance的價格來做價差合理的判斷
const { readFileSync } = require('fs');
require('dotenv').config();
const ethers = require("ethers");
const infura_ws_address = `wss://polygon-mainnet.infura.io/ws/v3/${process.env.infuraid}`;
const infura_http_address = `https://polygon-mainnet.infura.io/v3/${process.env.infuraid}`;
const provider_infura = new ethers.providers.JsonRpcProvider(infura_http_address);
const provider_infura_ws = new ethers.providers.WebSocketProvider(infura_ws_address);
const pool_interface = JSON.parse(readFileSync('./abi/IUniswapV3Pool.sol.json', 'utf8')).abi;

const pool_addr_list = { 
  '0x167384319b41f7094e62f7506409eb38079abff8':{base:'MATIC-ETH',name:'MATIC/ETH_03',cont:null,updfn:null}, // MATIC / WETH 0.3%
  '0x86f1d8390222a3691c28938ec7404a1661e618e0':{base:'MATIC-ETH',name:'MATIC/ETH_005',cont:null,updfn:null}, // MATIC / WETH 0.05%
  '0x50eaedb835021e4a108b7290636d62e9765cc6d7':{base:'BTC-ETH',name:'BTC/ETH_005',cont:null,updfn:null}, // WBTC / WETH 0.05%
  '0x0a28c2f5e0e8463e047c203f00f649812ae67e4f':{base:'MATIC-LINK',name:'MATIC/LINK_500',cont:null,updfn:null}, // MATIC / LINK 0.05%
  '0x1e5bd2ab4c308396c06c182e1b7e7ba8b2935b83':{base:'MATIC-RNDR',name:'MATIC/RNDR_03',cont:null,updfn:null}  // MATIC / RNDR 0.1%
};

var curPrice = {};
var callback = null;

const set_callback = (cb) => {
  callback = cb;
}
const getCurPrice = () => {
  return curPrice;
}

const fetch_ratio = async (sqrtx96) => {
  return new Promise(async (resolve, reject) => {
    let pool_price = (sqrtx96 ** 2)/2**192;
    resolve(pool_price);
  })
}

const fetch_ratio_btc = async (sqrtx96) => {
  return new Promise(async (resolve, reject) => {
    let pool_price = (sqrtx96 ** 2)/2**192;
    pool_price /= 10**10;
    resolve(pool_price);
  })
}

const upd_pool_price = async (poolAddress,sqrtPriceX96) => {
  let price = 0;
  if(poolAddress==='0x50eaedb835021e4a108b7290636d62e9765cc6d7'){
    price = await fetch_ratio_btc(sqrtPriceX96);
  }else{
    price = await fetch_ratio(sqrtPriceX96);
  }
  curPrice[ poolAddress ] = price;
  if(callback!==null){
    callback(poolAddress);
  }
  if(false){
    console.log(
      `pool ratio update ${pool_addr_list[poolAddress].name}
      price:${curPrice[poolAddress]}`
    );
  }
}

const uni_spread_proc_pair = async () => {
  
  for(let k=0;k<Object.keys(pool_addr_list).length;k++){
    const poolAddress = Object.keys(pool_addr_list)[k];
    const pool_contract_main_ws = new ethers.Contract(poolAddress, pool_interface , provider_infura_ws);
    // assign pool swap event
    pool_contract_main_ws.on('Swap',(sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick, event) => {
      upd_pool_price(poolAddress,sqrtPriceX96);
    });
  }
}

module.exports = {
  uni_spread_proc_pair,
  set_callback,
  getCurPrice,
  pool_addr_list
}