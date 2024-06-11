const { ethers } = require('ethers');
const { abi: IUniswapV3PoolABI } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const { abi: SwapRouterABI} = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json');
const ERC20ABI = require('../abi/ERC20.json');
require('dotenv').config();
const INFURA_URL_TESTNET = process.env.infuraurl;
const swapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';


const getPoolImmutables = async (poolContract) => {
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee()
  ])

  const immutables = {
    token0: token0,
    token1: token1,
    fee: fee
  }
  return immutables
}

const getPoolState = async (poolContract) => {
  const slot = poolContract.slot0()

  const state = {
      sqrtPriceX96: slot[0]
  }

  return state
}

const get_swap_router_contract = async (privateKey) => {
  const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET);
  const wallet = new ethers.Wallet(privateKey, provider);
  const signer = wallet.connect(provider);
  const swapRouterContract = new ethers.Contract(
    swapRouterAddress,
    SwapRouterABI,
    signer
  );
  return swapRouterContract;
}

// prepare all the infomation before the swap
const gather_swap_info = async (privateKey,poolAddress) => {
  const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET)
  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    provider
  )
  const immutables = await getPoolImmutables(poolContract);
  const wallet = new ethers.Wallet(privateKey, provider);
  const signer = wallet.connect(provider);
  const tokenContract0 = new ethers.Contract(immutables.token0, ERC20ABI, wallet);
  const tokenContract1 = new ethers.Contract(immutables.token1, ERC20ABI, wallet);
  const decimals0 = await tokenContract0.decimals();
  const decimals1 = await tokenContract1.decimals();
  console.log(`pool address ${poolAddress} token0:${immutables.token0} decimals:${decimals0}, token1:${immutables.token1} decimals:${decimals1}`);
  
  return {
    poolContract,
    immutables,
    wallet,
    signer,
    tokenContract0,
    decimals0,
    tokenContract1,
    decimals1
  }
}

// approve once for all
const approve_for_all = async (token,wallet) => {
  return new Promise(async (resolve, reject) => {
    const tokenContract0 = new ethers.Contract(token, ERC20ABI, wallet);
    const balanceOf = await tokenContract0.balanceOf(wallet.address);
    if(balanceOf>0){
      const approved_amt = await tokenContract0.allowance(wallet.address,swapRouterAddress);
      if((approved_amt/balanceOf)<0.5){
        const response = await tokenContract0.approve(
          swapRouterAddress,
          balanceOf
        )
        resolve(response);
      }else{
        resolve(`already approved for ${token} ${approved_amt}`)
      }
    }else{
      resolve(`insufficient ${token} amount`);
    }
  })
}

// runtime swap, prepare all the fetching process, just swap
const doSwap = async (
  signer,
  swapRouterContract,
  tokenIn,
  token0Decimal,
  tokenOut,
  fee,
  inputAmount=0.001
) => {
  
  // .001 => 1 000 000 000 000 000
  const amountIn = ethers.utils.parseUnits(
    inputAmount.toString(),
    token0Decimal
  )
  const params = {
    tokenIn,
    tokenOut,
    fee,
    recipient: signer.address,
    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  }
  
  const tx = await swapRouterContract.exactInputSingle(
    params,
    {
      gasLimit:3000000
    }
  );
  console.log("Transaction hash:", tx.hash);
  await tx.wait(); // Wait for transaction confirmation
  console.log("Transaction confirmed!");
  return tx;
}

module.exports={
    getPoolImmutables,
    getPoolState,
    get_swap_router_contract,
    gather_swap_info,
    approve_for_all,
    doSwap
}