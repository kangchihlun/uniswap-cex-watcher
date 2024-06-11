'use strict'
require('dotenv').config();
const wsURL = 'wss://ws-api.binance.com/ws-api/v3';
const { pair_update_content } = require('../config/pair_list');
const { DefaultLogger, WebsocketClient } = require('okx-api');
const { Console } = require('console')
const cron = require('node-cron');
const { json } = require('express');

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

const logger = {
  ...DefaultLogger,
  // silly: (...params) => console.log('silly', ...params),
};

// Main function
async function okx_spread_proc() {

  const wsClient = new WebsocketClient(
    {},
    logger
  );

  // Listen to the order book for the first 5 assets
  let subs = []
  for(let instId of Object.keys(pair_update_content)){
    const symbol = `${instId}-USDT`;
    subs.push(
      {
        channel: 'tickers',
        instId: symbol,
      }
    )
  }
  
  wsClient.on('open', (data) => {
    console.log('ws connection opened open:', data.wsKey);
  });
  
  // Replies (e.g. authenticating or subscribing to channels) will arrive on the 'response' event
  // wsClient.on('response', (data) => {
  //   console.log('ws response received: ', JSON.stringify(data, null, 2));
  // });

  wsClient.on('update', (data) => {
    if('data' in data){
      const raw = data.data
      if(raw.length>0){
        const book = raw[raw.length-1];
        const instId = raw[raw.length-1]['instId'];
        if('bidPx' in book){
          curBid[instId]= parseFloat(book.bidPx);
        }
        if('askPx' in book){
          curAsk[instId]= parseFloat(book.askPx);
        }

        if(callback!==null){
          callback(instId);
        }
      }
    }
  });

  wsClient.subscribe(subs);
}

module.exports = {
  okx_spread_proc,
  set_callback,
  set_order_callback,
  getCurBid,
  getCurAsk,
}
