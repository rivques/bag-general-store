import dotenv from 'dotenv';
dotenv.config();

import { App } from "@slack/bolt";
import genstoreBuy from './genstoreBuy';
import sendUpdate from './sendUpdate';
import calculatePrices from './calculatePrices';
import { App as BagApp } from '@hackclub/bag'
import { Item } from './types';

const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

if (!process.env.BAG_APP_ID) {
  throw new Error('env var BAG_APP_ID is not defined');
}
if (!process.env.BAG_APP_TOKEN) {
  throw new Error('env var BAG_APP_TOKEN is not defined');
}
let bagApp: BagApp;
(async () => {
  bagApp = await BagApp.connect({ appId: Number(process.env.BAG_APP_ID), key: process.env.BAG_APP_TOKEN! });
})();

let prices: Item[] = [];

// send/update messages on a 5  minute interval
setInterval(async () => {
  prices = await calculatePrices();
  await sendUpdate(slackApp.client, prices);
}, 300000);

// Listen for a /genstore-buy command
slackApp.command('/genstore-buy', async ({ ack, body, client, respond }) => {
  // Acknowledge command request
  await ack();
  await genstoreBuy(body, client, prices, bagApp, respond);
});

console.log(`Starting app...`);
(async () => {
  console.log(`Calculating initial prices...`)
  prices = await calculatePrices();
  console.log(`Sending update...`);
  await sendUpdate(slackApp.client, prices);
  console.log(`Launching slackbot...`)
  await slackApp.start();
  console.log('⚡️ Bolt app is running!');
})()