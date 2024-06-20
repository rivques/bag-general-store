import dotenv from 'dotenv';
dotenv.config();

import { App } from "@slack/bolt";
import genstoreBuy from './genstoreBuy';


const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// send/update messages on a 5  minute interval
setInterval(async () => {
  await genstoreBuy(app.client);
}, 300000);

// Listen for a /genstore-buy command
app.command('/genstore-buy', async ({ ack, body, client }) => {
  // Acknowledge command request
  await ack();
  await genstoreBuy(body, client);
});

(async () => {
    await app.start();
    console.log('⚡️ Bolt app is running!');
})