const pair_list = { 
    'MATIC/ETH_03':'MATIC/ETH',
    'MATIC/ETH_005':'MATIC/ETH',
    'BTC/ETH':'BTC/ETH',
    'MATIC/LINK':'MATIC/LINK',
    'MATIC/RNDR':'MATIC/RNDR',
}
const pair_update_content = { 
    'MATIC':['MATIC-ETH','MATIC-LINK','MATIC-RNDR'],
    'ETH':['MATIC-ETH','BTC-ETH','ETH-ARB','ETH-GMX','PENDLE-ETH'],
    'BTC':['BTC-ETH'],
    'LINK':['MATIC-LINK'],
    'RNDR':['MATIC-RNDR'],
    'ARB':['ETH-ARB'],
    'GMX':['ETH-GMX'],
    'PENDLE':['PENDLE-ETH'],
}

module.exports = {
    pair_list,
    pair_update_content,
}
