require('dotenv').config();
const ethers = require("ethers");
const{ Contract,constants, utils } = require( "ethers");
const USDCAddress = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
const WETHAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const SwapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ERC20ABI = require('../abi/ERC20.json');
const SwapRouterABI = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json').abi;
const providerUrl = `${process.env.localrpc}`;
const provider = new ethers.providers.JsonRpcProvider(providerUrl);
const signer = new ethers.Wallet(process.env.privatekey);
const connectedSigner = signer.connect(provider);
const { fetch_curr_price_fork } = require('./require_amount_est');
const Max_Interate_Num = 150;
const usdcDecimals = 6;
const wethDecimals = 18;
const fee = 500;
const Acceptable_diff_ratio = 0.01;


const usdcContract = new ethers.Contract(
  USDCAddress,
  ERC20ABI,
  connectedSigner
);
const wethContract = new ethers.Contract(
  WETHAddress,
  ERC20ABI,
  connectedSigner
);
const swapRouterContract = new ethers.Contract(
  SwapRouterAddress,
  SwapRouterABI,
  connectedSigner
);

const do_approve_usdc = async() => {
  // approve the swap , once is enough
  return new Promise(async (resolve, reject) => {
    const approval = 37316195423570985008;
    const _approvalAmount = ethers.utils.parseUnits(approval.toString(), usdcDecimals);
    const approvalAmount = _approvalAmount.toString();
    const approvalResponse = await usdcContract.approve(
      SwapRouterAddress,
      approvalAmount
    );
    resolve(approvalResponse);
  });
}

const do_approve_weth = async() => {
  // approve the swap , once is enough
  return new Promise(async (resolve, reject) => {
    const approval = 37316195423570985008;
    const _approvalAmount = ethers.utils.parseUnits(approval.toString(), wethDecimals);
    const approvalAmount = _approvalAmount.toString();
    const approvalResponse = await wethContract.approve(
      SwapRouterAddress,
      approvalAmount
    );
    resolve(approvalResponse);
  });
}

const do_swap = async (buy=true,amount) => {
  return new Promise(async (resolve, reject) => {
    if(amount<=0) return reject(`invalid amount ${amount}`);
    const params = {
      tokenIn: buy?USDCAddress:WETHAddress,
      tokenOut: buy?WETHAddress:USDCAddress,
      fee,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + (60 * 10),
      amountIn: amount.toString(),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }
    try{
      const tx = await swapRouterContract.exactInputSingle(
        params,
        {
          gasLimit: ethers.utils.hexlify(600000)
        }
      )
      const receipt = await tx.wait();
      resolve(receipt);
    }catch(err){
      reject(err);
    }
  })
}


module.exports= {
  do_approve_usdc,
  do_approve_weth,
  do_swap,
}