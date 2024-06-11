const { arbitrage_proc } = require('./utils/arbitrageur_coin');

const main = async () => {
  await arbitrage_proc();
}

main();