import { WebClient } from '@slack/web-api';
import { BuyOnlyRotatingItem, CoreItem, Item, PriceConglomerate, SellableRotatingItem } from './types';
import { Scheduler } from './scheduler';
import {MessageElement} from '@slack/web-api/dist/response/ConversationsHistoryResponse';

export default async function sendUpdate(client: WebClient, prices: PriceConglomerate, scheduler: Scheduler): Promise<void> {    
    console.log(`Sending price update to Slack...`)
    console.log(JSON.stringify(scheduler.jobs.map((job) => {return {state: job.state, date:  job.date, type:  job.updateType}}), null, 2))
    const nextPriceReroll = scheduler.jobs.filter((job) => job.state = "waiting").find((job) => job.updateType === 'price')?.date ?? new Date(Date.now() + 300000);
    const nextItemReroll = new Date(Date.now() + 24*3600*1000);

    // step 4
    if(!process.env.GENSTORE_CHANNEL) {
        throw new Error('env var GENSTORE_CHANNEL is not defined');
    }
    if(!process.env.SLACK_BOT_USER_ID) {
        throw new Error('env var SLACK_BOT_USER_ID is not defined');
    }
    // get all previous messages in the channel from us and delete them
    const messages = await client.conversations.history({
        channel: process.env.GENSTORE_CHANNEL,
    });
    if(messages.messages) {
        messages.messages.forEach(async (message: any) => {
            if(message.user === process.env.SLACK_BOT_USER_ID && (!message.text?.includes('These are yesterday\'s prices'))) {
                try {
                    if(!message.ts) {
                        console.error('No ts found for message: ');
                        console.error(message);
                        return;
                    }
                    await client.chat.update({
                        channel: process.env.GENSTORE_CHANNEL!,
                        ts: message.ts,
                        text: 'These are yesterday\'s prices. Please check the most recent message for the latest prices.' + (message.text ? `\n${message.text}` : ''),
                        blocks: [
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: '*These are yesterday\'s prices. Please check the most recent message for the latest prices.*'
                                }
                            }
                        ].concat(message.blocks.slice(0,-1))
                    });
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }

    console.log(nextPriceReroll.getTime()/1000);
    console.log(nextItemReroll.getTime()/1000);
    try {
        // blocks are the core items, a separator, the sellable rotatings, the buyonly rotatings, a note of the next update timings, and two buttons, one saying "buy" and one saying "sell"
        const blocks = [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "Welcome to the Bag General Store! Here's what I have for sale:"
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Core Items*\n${prices.coreItems.map((item: CoreItem) => `• :${item.tag}: ${item.name}: :gs-buy: ${item.sellToPlayerPrice} | :gs-sell: ${item.buyFromPlayerPrice} :-gp:`).join('\n')}`
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Today's Special Buys*\n${prices.sellableRotatingItems.map((item: SellableRotatingItem) => `• :${item.tag}: ${item.name}: :gs-buy: ${item.sellToPlayerPrice} :-gp:`).join('\n')}`
                }
            },
            {
                type: "divider",
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Today's Special Sells*\n${prices.buyOnlyRotatingItems.map((item: BuyOnlyRotatingItem) => `• :${item.tag}: ${item.name}: :gs-sell: ${item.buyFromPlayerPrice} :-gp:`).join('\n')}`
                }
            },
            {
                type: "divider",
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `Next item reroll at roughly <!date^${Math.round(nextItemReroll.getTime()/1000)}^{date_short_pretty}, {time}|${nextItemReroll.toLocaleTimeString()}>`
                }
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Buy",
                        },
                        value: "buy",
                        action_id: "open-buy"
                    },
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Sell",
                        },
                        value: "sell",
                        action_id: "open-sell"
                    }
                ]
            }
            
        ];
        let pricesString = 'Core Items: \n';
        for(const item of prices.coreItems) {
            pricesString += `• :${item.tag}: ${item.name}: :gs-buy: ${item.sellToPlayerPrice} :-gp: | :gs-sell: ${item.buyFromPlayerPrice}\n`;
        }
        pricesString += 'Today\'s Special Buys \n';
        for(const item of prices.sellableRotatingItems) {
            pricesString += `• :${item.tag}: ${item.name}: :gs-buy: ${item.sellToPlayerPrice} :-gp:\n`;
        }
        pricesString += 'Today\'s Special Sells: \n';
        for(const item of prices.buyOnlyRotatingItems) {
            pricesString += `• :${item.tag}: ${item.name}: :gs-sell: ${item.buyFromPlayerPrice} :-gp:\n`;
        }
        pricesString += `Next item reroll at roughly ${nextItemReroll.toLocaleTimeString()}`;

        const result = await client.chat.postMessage({
            channel: process.env.GENSTORE_CHANNEL,
            text: `Welcome to the Bag General Store! Here's what I have for sale:\n${pricesString}`,
            blocks
        });
        console.log('Message sent: ', result.ts);
    } catch (error) {
        console.error(error);
    }
}