import { BlockAction, PlainTextOption, RespondFn, SlackAction, SlackViewAction, SlashCommand } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { Item, PriceConglomerate } from "./types";
import { App as BagApp, Instance } from "@hackclub/bag";

export async function showSellModal(client: WebClient, body: BlockAction, prices: PriceConglomerate){
    // a modal with a dropdown of items to sell. The user selects an item and then enters a quantity.
    let items: PlainTextOption[] = (prices.coreItems as Item[]).concat(prices.buyOnlyRotatingItems).map((item: Item) => ({
        text: {
            type: 'plain_text',
            text: `:${item.tag}: ${item.name} | :gs-sell: ${item.buyFromPlayerPrice} :-gp:`,
        },
        value: item.name,
    }));

    await client.views.open({
        trigger_id: body.trigger_id,
        view: {
            type: 'modal',
            callback_id: 'sell-modal-submit',
            title: {
                type: 'plain_text',
                text: 'Sell Items',
            },
            submit: {
                type: 'plain_text',
                text: 'Sell',
            },
            blocks: [
                {
                    type: 'section',
                    block_id: 'sell-item-name',
                    text: {
                        type: 'plain_text',
                        text: 'Select an item to sell:',
                    },
                    accessory: {
                        type: 'static_select',
                        action_id: 'sell-item-name',
                        placeholder: {
                            type: 'plain_text',
                            text: 'Select an item',
                        },
                        options: items
                    },
                },
                {
                    type: 'input',
                    block_id: 'quantity',
                    element: {
                        type: 'number_input',
                        action_id: 'quantity',
                        is_decimal_allowed: false,
                        placeholder: {
                            type: 'plain_text',
                            text: 'Enter a quantity',
                        }
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Quantity',
                    }
                }
            ]
        }
    })
}

export async function handleSellModalSubmit(client: WebClient, body: SlackViewAction, prices: PriceConglomerate, bagApp: BagApp){
    // get the item and quantity from the modal, and then make a purchase offer to the user
    const selectedOption = body.view.state.values['sell-item-name']['sell-item-name'].selected_option;
    if(!selectedOption) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `Please select an item to buy!`
        });
        return;
    }
    const itemName = selectedOption.value;
    const quantity = body.view.state.values['quantity']['quantity'].value;
    if(!quantity) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `Please enter a quantity to buy!`
        });
        return;
    }
    if(Number.isNaN(Number(quantity))) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `Please enter a valid quantity!`
        });
        return;
    }
    if(Number(quantity) < 1) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `Please enter a quantity greater than 0!`
        });
    }
    const itemToSell = (prices.coreItems as Item[]).concat(prices.buyOnlyRotatingItems).concat(prices.sellableRotatingItems).find((item: Item) => item.name.toLowerCase() === itemName.toLowerCase());
    if(!itemToSell) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `I don't know about any ${itemName}!`
        });
        return;
    }
    const totalPrice = itemToSell.buyFromPlayerPrice * Number(quantity);
    console.log(`User ${body.user.id} wants to sell ${quantity} ${itemName} for ${totalPrice} :-gp:`)
    // check if we have enough gp for this, and if we don't, create more
    const userInventory = await bagApp.getInventory({
        identityId: process.env.SLACK_BOT_USER_ID!,
        available: true,
    })
    const myBalance = userInventory.filter((instance: Instance)  => instance.itemId == 'gp').reduce((acc: number, instance: Instance) => acc + (instance.quantity ?? 0), 0);
    if(myBalance < totalPrice) {
        // summon more gp
        await bagApp.createInstance({
            identityId: process.env.SLACK_BOT_USER_ID!,
            itemId: 'gp',
            quantity: 3000 + totalPrice,
        });
        return;
    }
    // make offer to user
    console.log(`making offer:`)
    const result = await bagApp.makeOffer({
        sourceIdentityId: process.env.SLACK_BOT_USER_ID!,
        targetIdentityId: body.user.id,
        offerToReceive: [{itemName: itemToSell.name, quantity: Number(quantity)}],
        offerToGive: [{itemName: 'gp', quantity: totalPrice}]
    })
    console.log(result)
}

export async function genstoreSell(body: SlashCommand, client: WebClient, prices: Item[], bagApp: BagApp, respond: RespondFn){
    // make sure channel is correct
    if(body.channel_id !== process.env.GENSTORE_CHANNEL) {
        respond({
            response_type: 'ephemeral',
            text: `Please use the <#${process.env.GENSTORE_CHANNEL}> channel to buy items!`
        });
        return;
    }
    let [itemName, quantity] = body.text.split(' ');
    const itemToSell = prices.find((item: Item) => item.name.toLowerCase() === itemName.toLowerCase());
    if(!itemToSell) {
        client.chat.postEphemeral({
            user: body.user_id,
            channel: body.channel_id,
            text: `I don't know about any ${itemName}!`
        });
        return;
    }
    if (!quantity){
        quantity = "1";
    }
    const totalPrice = itemToSell.buyFromPlayerPrice * Number(quantity);
    if (Number.isNaN(totalPrice)){
        client.chat.postEphemeral({
            user: body.user_id,
            channel: body.channel_id,
            text: `Please enter a valid quantity!`
        });
        return;
    }
    if (Number(quantity) < 1){
        client.chat.postEphemeral({
            user: body.user_id,
            channel: body.channel_id,
            text: `Please enter a quantity greater than 0!`
        });
        return;
    }
    console.log(`User ${body.user_id} wants to sell ${quantity} ${itemName} for ${totalPrice} :-gp:`)
    // check if we have enough gp for this, and if we don't, create more
    const userInventory = await bagApp.getInventory({
        identityId: process.env.SLACK_BOT_USER_ID!,
        available: true,
    })
    const myBalance = userInventory.filter((instance: Instance)  => instance.itemId == 'gp').reduce((acc: number, instance: Instance) => acc + (instance.quantity ?? 0), 0);
    if(myBalance < totalPrice) {
        // summon more gp
        await bagApp.createInstance({
            identityId: process.env.SLACK_BOT_USER_ID!,
            itemId: 'gp',
            quantity: 3000 + totalPrice,
        });
        return;
    }
    // make offer to user
    console.log(`making offer:`)
    const result = await bagApp.makeOffer({
        sourceIdentityId: process.env.SLACK_BOT_USER_ID!,
        targetIdentityId: body.user_id,
        offerToReceive: [{itemName: itemToSell.name, quantity: Number(quantity)}],
        offerToGive: [{itemName: 'gp', quantity: totalPrice}]
    })
    console.log(result)
}