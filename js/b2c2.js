'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ArgumentsRequired, AuthenticationError } = require ('./base/errors');
const Precise = require ('./base/Precise');

//  ----------------------------modelled on btcbox------------------------------------

module.exports = class b2c2 extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'b2c2',
            'name': 'B2C2',
            'countries': [ 'GB' ],
            'rateLimit': 500,
            'has': {
                'cancelOrder': false,
                'CORS': false,
                'createOrder': true,
                'fetchBalance': true,
                'fetchCurrencies': true,
                'fetchFundingHistory': true,
                'fetchFundingRate': true,
                'fetchFundingRates': true,
                'fetchMarkets': true,
                'fetchLedger': true,
                'fetchMyTrades': true,
                'fetchOpenOrders': false,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchWithdrawals': true,
                'withdraw': true,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/28208429-3cacdf9a-6896-11e7-854e-4c79a772a30f.jpg',
                'test': {
                    'private': 'https://api.uat.b2c2.net',
                },
                'api': {
                    'private': 'https://api.b2c2.net',
                },
                'www': 'https://b2c2.com',
                'doc': 'https://docs.b2c2.net',
            },
            'api': {
                'private': {
                    'get': [
                        'balance',
                        'margin_requirements',
                        'instruments',
                        'order',
                        'order/{client_order_id}',
                        'trade',
                        'ledger',
                        'withdrawal',
                        'currency',
                        'funding_rates',
                        'account_info',
                    ],
                    'post': [
                        'request_for_quote',
                        'order',
                        'withdrawal',
                    ],
                },
            },
            'markets': {
                'BTCUSD.SPOT': { 'id': 'btc', 'symbol': 'BTCUSD.SPOT', 'base': 'BTC', 'quote': 'USD', 'baseId': 'btc', 'quoteId': 'usd' },
                'ETHUSD.SPOT': { 'id': 'eth', 'symbol': 'ETHUSD.SPOT', 'base': 'ETH', 'quote': 'USD', 'baseId': 'eth', 'quoteId': 'usd' },
            },
            'exceptions': { //https://docs.b2c2.net/#errors
                '400': ExchangeError, // At least one parameter wasn't set
                '401': InvalidOrder, // Invalid order type
                '402': InvalidOrder, // No orders with specified currencies
                '403': InvalidOrder, // Invalid payment currency name
                '404': InvalidOrder, // Error. Wrong transaction type
                '405': InvalidOrder, // Order with this id doesn't exist
                '406': InsufficientFunds, // No enough money or crypto
                // code 407 not specified are not specified in their docs
                '408': InvalidOrder, // Invalid currency name
                '501': AuthenticationError, // Invalid public key
                '502': AuthenticationError, // Invalid sign
                '503': InvalidNonce, // Invalid moment parameter. Request time doesn't match current server time
                '504': ExchangeError, // Invalid method
                '505': AuthenticationError, // Key has no permission for this action
                '506': AccountSuspended, // Account locked. Please contact with customer service
                // codes 507 and 508 are not specified in their docs
                '509': ExchangeError, // The BIC/SWIFT is required for this currency
                '510': BadSymbol, // Invalid market name
            },
        });
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privateGetBalance (params);
        const result = { 'info': response };
        const codes = Object.keys (this.currencies);
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            const currency = this.currency (code);
            const currencyId = currency['id'];
            const free = currencyId + '_balance';
            if (free in response) {
                const account = this.account ();
                const used = currencyId + '_lock';
                account['free'] = this.safeString (response, free);
                account['used'] = this.safeString (response, used);
                result[code] = account;
            }
        }
        return this.parseBalance (result, false);
    }

    async fetchBalance (params = {}) {
        //{
        //    "USD": "0",
        //    "BTC": "0",
        //    "JPY": "0",
        //    "GBP": "0",
        //    "ETH": "0",
        //    "EUR": "0",
        //    "CAD": "0",
        //    "LTC": "0",
        //    "XRP": "0",
        //    "BCH": "0"
        //}
        await this.loadMarkets ();
        const response = await this.privateGetBalance (params);
        const data = response['data'];
        const result = { 'info': response };
        for (let i = 0; i < data.length; i++) {
            const balance = data[i];
            const currencyId = this.safeString (balance, 'currency');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['used'] = this.safeString (balance, 'frozen');
            account['free'] = this.safeString (balance, 'active');
            account['total'] = this.safeString (balance, 'fix');
            result[code] = account;
        }
        return this.parseBalance (result, false);
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'cointype': market['id'],
        };
        const response = await this.privatePostOrdersHistory (this.extend (request, params));
        const trades = this.safeValue (response, 'orders', []);
        return this.parseTrades (trades, market, since, limit);
    }

    parseTrade (trade, market = undefined) {
        const priceString = this.safeString (trade, 'rate');
        const amountString = this.safeString (trade, 'amount');
        const price = this.parseNumber (priceString);
        const amount = this.parseNumber (amountString);
        let cost = this.safeNumber (trade, 'total');
        if (cost === undefined) {
            cost = this.parseNumber (Precise.stringMul (priceString, amountString));
        }
        const timestamp = this.safeInteger (trade, 'solddate');
        const marketId = this.safeString (trade, 'market');
        const symbol = this.safeSymbol (marketId, market, '/');
        return {
            'info': trade,
            'id': undefined,
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'order': undefined,
            'type': undefined,
            'side': undefined,
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const method = 'privatePostMy' + this.capitalize (side);
        if (type === 'market') {
            throw new ExchangeError (this.id + ' allows limit orders only');
        }
        const request = {
            'cointype': this.marketId (symbol),
            'amount': amount,
            'rate': price,
        };
        return await this[method] (this.extend (request, params));
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        if (!this.apiKey) {
            throw new AuthenticationError (this.id + ' requires apiKey for all requests');
        }
        const url = this.urls['api'][api] + '/' + path;
        if (api === 'private') {
            this.checkRequiredCredentials ();
            const nonce = this.nonce ();
            body = this.json (this.extend ({ 'nonce': nonce }, params));
            headers = {
                'Content-Type': 'application/json',
                'key': this.apiKey,
                'sign': this.hmac (this.encode (body), this.encode (this.secret), 'sha512'),
            };
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
