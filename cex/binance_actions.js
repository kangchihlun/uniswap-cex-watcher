const { Spot } = require('@binance/connector');
const client = new Spot(process.env.binancekey, process.env.binancesecret);

// Function to loan an asset
async function loanAsset(asset, amount) {
  try {
    
    const result = await client.marginBorrow(
      asset, // asset
      amount // amount
    );
    console.log('Loan Result:', result);
  } catch (error) {
    console.error(`Error loaning ${amount} ${asset}:`, error.body);
  }
}

async function marginSell(asset,amount,price,type='LIMIT') {
  try {
    return await client.newMarginOrder(
      asset, // symbol
      'SELL',
      type,
      {
        quantity: amount,
        price,
        newClientOrderId: 'my_order',
        newOrderRespType: 'FULL',
        timeInForce: 'GTC'
      }
    );
  } catch (error) {
    console.error(`Error shorting ${amount} ${asset}:`, error.body);
  }
}

// Function to sell an asset margin ocoo
async function sellMarginAsset(symbol, quantity, price) {
  try{
    const result = await client.marginOCOOrder(symbol, 'SELL', 1, 10, 12, {
      listClientOrderId: 'my_oco_order',
      stopLimitPrice: 13,
      stopLimitTimeInForce: 'GTC'
    });
    console.log('Sell Order Result:', result);
  } catch (error) {
    console.error(`Error selling ${quantity} ${symbol} at ${price}:`, error.body);
  }
}

// Function to repay a loaned asset
async function repayAsset(asset, amount) {
  try {
    const result = await client.marginRepay(
      asset, // asset
      amount // amount
    );
    console.log('Repay Result:', result);
  } catch (error) {
    console.error(`Error repaying ${amount} ${asset}:`, error.body);
  }
}


module.exports = {
  loanAsset,
  marginSell,
  sellMarginAsset,
  repayAsset,
}
