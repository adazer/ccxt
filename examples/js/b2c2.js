"use strict";

const ccxt      = require ('../../ccxt.js')
const asTable   = require ('as-table')
const log       = require ('ololog').configure ({ locate: false })

require ('ansicolor').nice

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async () => {

    // instantiate the exchange
    let exchange = new ccxt.b2c2  ({
        "apiKey": "c2ed21ef1e8c278dde40bafdb6b81736f93fb7b1",
    })

    // fetch currencies from the exchange
    // let currencies = await exchange.fetchCurrencies ()

    // output the result
    // log (exchange.name.green, 'currencies', currencies)

    // fetch markets from the exchange
    // let markets = await exchange.fetchMarkets ()

    // output the result
    // log (exchange.name.green, 'markets', markets)
    // fetch markets from the exchange

    // let orders = await exchange.fetchOrders ()

    // // output the result
    // log (exchange.name.green, 'orders', orders)

    // let ledger = await exchange.fetchLedger ()

    // // output the result
    // log (exchange.name.green, 'ledger', ledger)

    let trades = await exchange.fetchMyTrades ()

    // output the result
    log (exchange.name.green, 'trades', trades)

    // fetch account balance from the exchange
    // let balance = await exchange.fetchBalance ()

    // output the result
    // log (exchange.name.green, 'balance', balance)


}) ()