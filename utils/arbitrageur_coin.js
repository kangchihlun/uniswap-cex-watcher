require('dotenv').config();
const { pair_update_content } = require('../config/pair_list');
const ethers = require("ethers");
const { coin_list } = require('../config/coin_list');
const { okx_spread_proc,getCurAsk,getCurBid } = require('../cex/okx_watcher');
const { uni_spread_proc_pair,getCurPrice,pool_addr_list } = require('../dex/uniswap_wacher_pair');
const { set_callback:set_callback_okx } = require('../cex/okx_watcher');
const { set_callback:set_callback_uni } = require('../dex/uniswap_wacher_pair');
const cron = require('node-cron');
const { 
    get_swap_router_contract,
    gather_swap_info,
    approve_for_all,
    doSwap 
  } = require('../dex/uniswap_actions');
const {
    addSpreadData,
    calculateStandardDeviation,
    removeSpreadDataBeforeTimestamp
} = require('../models/coin_spread_utils');

var curRatioAsk_cex = {};
var curRatioBid_cex = {};
var curRatio_dex_005 = {}; // swap ratio 0.05%
var curRatio_dex_03 = {}; // swap ratio 0.3%
var discrepancy = {};
var position = {};

const MIN_ARB_THRS = process.env.MIN_ARB_THRS; // 四腳來回的手續費&滑價門檻
const CLOSE_ARB_THRS = process.env.CLOSE_ARB_THRS; // 關倉閥值

const symbol_list = coin_list.map((coin) => {
    return `${coin}-USDT`
})

var signer=null;
var swapRouterContract = null;
const pool_gather_info = {} // pool info

const prepare_swap_info = async () => {
    const privateKey = process.env.privatekey;
    swapRouterContract = await get_swap_router_contract(process.env.privatekey);
    const provider = new ethers.providers.JsonRpcProvider(process.env.infuraurl);
    const wallet = new ethers.Wallet(privateKey, provider);
    signer = wallet.connect(provider);
    
    let token_list = []
    for (const [key, value] of Object.entries(pool_addr_list)){
        const info_name = pool_addr_list[key].name;
        if(!(info_name in Object.keys(pool_gather_info))){
            const {
                poolContract,
                immutables,
                wallet,
                signer,
                tokenContract0,
                decimals0,
                tokenContract1,
                decimals1
              } = await gather_swap_info(process.env.privatekey,key);  
            pool_gather_info[info_name] = {
                poolContract,
                immutables,
                wallet,
                signer,
                tokenContract0,
                decimals0,
                tokenContract1,
                decimals1
            };
            
            if(!(immutables.token0 in token_list)){
                token_list.push(immutables.token0);
            }
            if(!(immutables.token1 in token_list)){
                token_list.push(immutables.token1);
            }
        }
    }

    // approve all token
    // for(const coinaddr of token_list){
    //     const res1 = await approve_for_all(coinaddr,wallet);
    //     if(res1){
    //         console.log(`approved for ${coinaddr}`);
    //         console.log(res1);
    //     }
    // }
}

const on_notify_discrepancy = async (symbol_or_addr) => {
    let curPrice = getCurPrice();
    let curAsk = getCurAsk();
    let curBid = getCurBid();
    if(!curPrice)return;
    if(!curAsk)return;
    if(!curBid)return;
    if(Object.keys(curPrice).length<1)return;
    if(Object.keys(curAsk).length<1)return;
    if(Object.keys(curBid).length<1)return;

    if(symbol_list.includes(symbol_or_addr)){ // symbol price update from okx
        const symbol = symbol_or_addr.slice(0, -5);
        for(pair of pair_update_content[symbol]){
            let symb1 = `${pair.split('-')[0]}-USDT`;
            let symb2 = `${pair.split('-')[1]}-USDT`;
            let curRatioAsk = 0;
            let curRatioBid = 0;
            if((symb1 in curAsk)&&(symb2 in curAsk)){
                curRatioAsk = curAsk[symb1]/curAsk[symb2];
            }
            if((symb1 in curBid)&&(symb2 in curBid)){
                curRatioBid = curBid[symb1]/curBid[symb2];
            }
            curRatioAsk_cex[pair] = curRatioAsk;
            curRatioBid_cex[pair] = curRatioBid;
            if(false){
                console.log(`update ${symbol_or_addr} curr ask ratio ${pair} : ${curRatioAsk}`);
                console.log(`update ${symbol_or_addr} curr bid ratio ${pair} : ${curRatioBid}`);
            }
            if((curRatioBid==0)||(curRatioAsk==0))continue
            // update discrepancy
            let curr_ration_dex = null;
            let tgt_gather_info = `${pair}_03`;
            if(pair in curRatio_dex_005){
                curr_ration_dex = curRatio_dex_005[pair];
                tgt_gather_info = `${pair}_005`
            }
            if(pair in curRatio_dex_03){
                curr_ration_dex = curRatio_dex_03[pair];
            }
            
            if(curr_ration_dex != null){
                const descrepancy = ((curRatioAsk+curRatioBid)*0.5-curr_ration_dex)/curr_ration_dex;
                const descrepancy_abs = Math.abs(descrepancy);
                console.log(` ${symbol_or_addr} descrepancy_abs ${pair} : ${descrepancy_abs}`);
                if(descrepancy_abs >= parseFloat(MIN_ARB_THRS)){
                    if(!position[pair]){
                        const open_time = Date.now();
                        const c_gather_info = pool_gather_info[tgt_gather_info];
                        let tokenIn = descrepancy>0?c_gather_info.immutables.token0:c_gather_info.immutables.token1;
                        let tokenOut = descrepancy>0?c_gather_info.immutables.token1:c_gather_info.immutables.token0;
                        let token0Decimal = descrepancy>0?c_gather_info.decimals0:c_gather_info.decimals1;
                        
                        long_symbol = descrepancy>0?symb1:symb2;
                        short_symbol = descrepancy>0?symb2:symb1;
                        // const entry_tx = await doSwap(
                        //     signer,
                        //     swapRouterContract,
                        //     tokenIn,
                        //     token0Decimal,
                        //     tokenOut,
                        //     c_gather_info.immutables.fee,
                        //     inputAmount=0.001
                        // );
                        if(descrepancy>0){
                            console.log(`just swap long ${symb1} and sell ${symb2}`);
                        }else{
                            console.log(`just swap long ${symb2} and short ${symb1}`);
                        }
                        console.log(entry_tx);
                        
                        if(entry_tx){
                            position[tgt_gather_info] = {
                                tokenIn,
                                tokenOut,
                                long_symbol,
                                short_symbol,
                                txid:entry_tx,
                                time:open_time
                            }
                            console.log(`open ${pair} ,curr descrepancy : ${descrepancy} time:${open_time}`);
                        }
                    }
                }
                if(descrepancy_abs<CLOSE_ARB_THRS){
                    if(position[tgt_gather_info]){
                        const close_time = Date.now();
                        position[tgt_gather_info] 
                        position[pair] = null;
                        console.log(`close ${pair} ,curr descrepancy : ${descrepancy} time:${close_time}`);
                    }
                }
            }
        }
    }else if(symbol_or_addr in curPrice){ // pool addr
        const fee = pool_addr_list[symbol_or_addr].name.split('_')[1];
        const pair_base = pool_addr_list[symbol_or_addr].base;
        const curr_ration_dex = curPrice[symbol_or_addr];
        if(fee=='03'){
            curRatio_dex_03[pair_base] = curr_ration_dex;
        }else{
            const pair_base = pool_addr_list[symbol_or_addr].base;
            const curr_ration_dex = curPrice[symbol_or_addr];
            curRatio_dex_005[pair_base] = curr_ration_dex;
        }
    }
}

const cron_task = async () => {
    //console.log(`------------------------------------------------------- `);
    //console.log(`Time to update current descrepancy to database`);
    for(let pair of Object.keys(curRatioAsk_cex)){
        const cex_ratio = (curRatioBid_cex[pair]+curRatioAsk_cex[pair]);
        const dex_ratio = curRatio_dex[pair];
    }
    // todo: delete database data more than 2 days
    //console.log(`Time to update current descrepancy to database`);
}

const arbitrage_proc = async () => {
    await prepare_swap_info();
    set_callback_okx(on_notify_discrepancy);
    set_callback_uni(on_notify_discrepancy);
    await okx_spread_proc();
    await uni_spread_proc_pair();

    // record current bid ask price every 5 minute
    let cron_interval = '*/5 * * * *' // 
    if(process.env.environment==='develop'){
        cron_interval = '* * * * *'
    }
    cron.schedule(cron_interval, cron_task);
}
  
module.exports = {
    arbitrage_proc
}