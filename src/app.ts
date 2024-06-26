import dotenv from 'dotenv';
dotenv.config();

import { App, BlockAction } from "@slack/bolt";
import { handleBuyModalSubmit, showBuyModal} from './genstoreBuy';
import { App as BagApp } from '@hackclub/bag'
import { Item, PriceConglomerate } from './types';
import {genstoreSell, handleSellModalSubmit, showSellModal} from './genstoreSell';
import { Scheduler } from './scheduler';
import sendUpdate from './sendUpdate';

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

const scheduler = new Scheduler(slackApp.client);
scheduler.loadAll("data/jobs.json", "data/prices.json");
setInterval(async () => {
  await scheduler.saveAll("data/jobs.json", "data/prices.json");
}, 30000);


// slackApp.action('genstore-sell', async ({ ack, body, client }) => {
//   await ack();
//   await showSellModal(client, body as BlockAction, scheduler.prices);
// });

slackApp.action('open-buy', async ({ ack, body, client }) => {
  await ack();
  await showBuyModal(client, body as BlockAction, scheduler.prices!);
})

slackApp.action('buy-item-name', async ({ ack, body, client }) => {
  await ack();
})
slackApp.view('buy-modal-submit', async ({ ack, body, client }) => {
  await ack();
  await handleBuyModalSubmit(client, body, scheduler.prices!, bagApp);
})

slackApp.action('open-sell', async ({ ack, body, client }) => {
  await ack();
  await showSellModal(client, body as BlockAction, scheduler.prices!);
})

slackApp.action('sell-item-name', async ({ ack, body, client }) => {
  await ack();
})

slackApp.view('sell-modal-submit', async ({ ack, body, client }) => {
  await ack();
  await handleSellModalSubmit(client, body, scheduler.prices!, bagApp);
})
// // Listen for a /genstore-buy command
// slackApp.command('/genstore-buy', async ({ ack, body, client, respond }) => {
//   // Acknowledge command request
//   await ack();
//   await genstoreBuy(body, client, prices, bagApp, respond);
// });

// slackApp.command('/genstore-sell', async ({ ack, body, client, respond }) => {
//   // Acknowledge command request
//   await ack();
//   await genstoreSell(body, client, prices, bagApp, respond);
// });

console.log(`Starting app...`);
(async () => {
  console.log(`Launching slackbot...`)
  await slackApp.start();
  console.log('⚡️ Bolt app is running!');
  await sendUpdate(slackApp.client, scheduler.prices!, scheduler);
})()


process.on('SIGINT', async function () {
  console.log('Caught interrupt signal');
  await scheduler.stopAllJobs();
  await scheduler.saveAll("data/jobs.json", "data/prices.json");
  process.exit();
});

process.on('SIGTERM', async function () {
  console.log('Caught terminate signal');

  await scheduler.stopAllJobs();
  await scheduler.saveAll("data/jobs.json", "data/prices.json");
  process.exit();
});