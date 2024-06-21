import { WebClient } from '@slack/web-api';
import { Item } from './types';

export default async function sendUpdate(client: WebClient, prices: Item[]): Promise<void> {
    // step 1. get items.yaml for new price
    // step 2. calculate random price variances
    // step 3. construct new message
    // step 4. send message to channel
    console.log(`Sending price update to Slack...`)

    if(!process.env.ITEMS_TO_STOCK) {
        throw new Error('env var ITEMS_TO_STOCK is not defined');
    }
    const itemNamesToStock = process.env.ITEMS_TO_STOCK.split(',');
    const itemsToStock = prices.filter((item: Item) => itemNamesToStock.includes(item.name));

    // step 3
    const pricesString = itemsToStock.reduce((acc: string, item: Item) => {
        return acc + `${item.name} :${item.tag}:: ${item.sellToPlayerPrice} :-gp:\n`;
    }, '');
    
    // step 4
    if(!process.env.GENSTORE_CHANNEL) {
        throw new Error('env var GENSTORE_CHANNEL is not defined');
    }
    if(!process.env.SLACK_BOT_ID) {
        throw new Error('env var SLACK_BOT_ID is not defined');
    }
    // get all previous messages in the channel from us and delete them
    const messages = await client.conversations.history({
        channel: process.env.GENSTORE_CHANNEL,
    });
    if(messages.messages) {
        messages.messages.forEach(async (message: any) => {
            if(message.bot_id === process.env.SLACK_BOT_ID) {
                try {
                    await client.chat.delete({
                        channel: process.env.GENSTORE_CHANNEL!,
                        ts: message.ts,
                    });
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }
    try {
        const result = await client.chat.postMessage({
            channel: process.env.GENSTORE_CHANNEL,
            text: `Welcome to the Bag General Store! Here's what I have for sale:\n${pricesString}\nUse \`/genstore-buy\` to buy items from me! (example: \`/genstore-buy iron 10\`)\nYou can also sell items to me with \`/genstore-sell\`! (example: \`/genstore-sell log 3\`)\nWatch for prices to change every now and then!`,
        });
        console.log('Message sent: ', result.ts);
    } catch (error) {
        console.error(error);
    }
}