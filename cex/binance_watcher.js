'use strict'
require('dotenv').config();
const wsURL = 'wss://ws-api.binance.com/ws-api/v3';
const { coin_list } = require('../config/coin_list');
const { WebsocketStream, WebsocketAPI } = require('@binance/connector');
const { Console } = require('console')
const logger = new Console({ stdout: process.stdout, stderr: process.stderr });
const cron = require('node-cron');

var curBid = {};
var curAsk = {};
var callback = null;
var orderCallback = null;

const set_callback = (cb) => {
  callback = cb;
}

const set_order_callback = (cb) => {
  orderCallback = cb;
}

const getCurBid = () => {
  return curBid;
}

const getCurAsk = () => {
  return curAsk;
}

function writeSpreadToDatabase() {
  const timestamp = Date.now();
  Object.keys(curBid).forEach(symbol => {
    const bid = curBid[symbol];
    const ask = curAsk[symbol];
    // add record curr bid ask
  });
}

// Main function
async function binance_spread_proc() {
  const callbacks = {
    open: () => console.log('Connected with Websocket server'),
    close: () => console.log('Disconnected with Websocket server'),
    message: (data) => {
      let book = JSON.parse(data);
      if('b' in book){
        if(book.b.length>0){
          curBid[book.s]= parseFloat(book.b[0][0]);
        }
      }
      if('a' in book){
        if(book.a.length>0){
          curAsk[book.s]= parseFloat(book.a[0][0]);
        }
      }
      if(callback!==null){
        callback(book.s);
      }
      // debug
      if(false){
        cnt += 1;
        if(cnt===100){
          cnt=0;
          console.log(curBid);
          console.log(curAsk);
        }
      }
    }
  }
  const websocketStreamClient = new WebsocketStream({ logger, callbacks });
  
  // Listen to the order book for the first 5 assets
  for (let i = 0; i < coin_list.length; i++) {
    const symbol = coin_list[i] + 'USDT';
    websocketStreamClient.diffBookDepth(symbol.toLowerCase(),'100ms');
  }

  // listen to order filled channel and callback;
  const callbacks_trade = {
    open: () => console.log('Connected with Websocket server'),
    close: () =>  console.log('Disconnected with Websocket server'),
    message: data => {
      let trade_record = JSON.parse(data);
      console.log(data);
    }
  }
  
  const websocketAPIClient = new WebsocketAPI(process.env.binancekey,
    process.env.binancesecret, { logger, callbacks_trade, wsURL });

  // ping server every 5 minute
  cron.schedule('*/5 * * * *', () => {
    websocketStreamClient.pingServer();
  });
}

module.exports = {
  binance_spread_proc,
  set_callback,
  set_order_callback,
  getCurBid,
  getCurAsk,
}
