'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const request = require('request-promise');

// 最大表示数 (1～5)
const display_max = 5;

// 探索半径 (m)
var radius = 500;

// Google Map Platform の APIキー
var api_key = process.env.API_KEY;

// create LINE SDK config from env variables
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/
const app = express();

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/callback', line.middleware(config), (req, res) => {
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

function getPlaceDetails(url) {
    return new Promise((resolve, reject) => {
        var options = {
            url: url,
            method: 'GET'
        }
        request(options)
            .then(function (body) {

                return resolve(JSON.parse(body));

            })
            .catch(function (err) {

                console.log(err);

            });
    });

}

async function replyUrls(event, urls) {
    var msgs = [];
    for (let index = 0; index < urls.length; index++) {
        const name = urls[index].name;
        const url = urls[index].url;
        var details = await getPlaceDetails(url);
        var msg = { type: 'text', text: name + '\n' + details.result.url };
        msgs.push(msg);
    }
    return client.replyMessage(event.replyToken, msgs);
}

// event handler
function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'location') {
        const errMsg = { type: 'text', text: '位置情報を送信してください' };
        return client.replyMessage(event.replyToken, errMsg);
    }

    const latitude = event.message.latitude;    // 緯度
    const longitude = event.message.longitude;  // 経度

    var api_url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?';
    api_url += 'location=' + latitude + ',' + longitude;
    api_url += '&language=ja'
    api_url += '&radius=' + radius;
    api_url += '&types=cafe'
    api_url += '&key=' + api_key;

    var options = {
        url: api_url,
        method: 'GET'
    }
    request(options)
        .then(function (body) {
            var json = JSON.parse(body);
            var results = json.results;
            return results;
        })
        .then(function (results) {
            var urls = [];
            for (let index = 0; index < results.length && index < display_max; index++) {
                const name = results[index].name;
                const place_id = results[index].place_id;
                var url = 'https://maps.googleapis.com/maps/api/place/details/json?placeid=' + place_id;
                url += '&fields=url&key=' + api_key;
                urls.push({ name: name, url: url });
            }
            return urls;
        })
        .then(function (urls) {
            replyUrls(event, urls);
        })
        .catch(function (err) {
            console.log(err);
        });
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});