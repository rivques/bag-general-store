import { BlockAction, PlainTextOption, RespondFn, SlackViewAction, SlashCommand } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { CoreItem, Item, PriceConglomerate, SellableRotatingItem } from "./types";
import { App as BagApp, Instance } from "@hackclub/bag";

export async function showBuyModal(client: WebClient, body: BlockAction, prices: PriceConglomerate){
    // a modal with a dropdown of items to buy. The user selects an item and then enters a quantity.
    let items: PlainTextOption[] = prices.coreItems.map((item: CoreItem) => ({
        text: {
            type: 'plain_text',
            text: `:${item.tag}: ${item.name} | :gs-buy: ${item.sellToPlayerPrice} :-gp:`,
        },
        value: item.name,
    }));
    items = items.concat(prices.sellableRotatingItems.map((item: SellableRotatingItem) => ({
        text: {
            type: 'plain_text',
            text: `:${item.tag}: ${item.name} | :gs-buy: ${item.sellToPlayerPrice} :-gp:`,
        },
        value: item.name,
    })));
    await client.views.open({
        trigger_id: body.trigger_id,
        view: {
            type: 'modal',
            callback_id: 'buy-modal-submit',
            title: {
                type: 'plain_text',
                text: 'Buy Items',
            },
            submit: {
                type: 'plain_text',
                text: 'Buy',
            },
            blocks: [
                {
                    type: 'section',
                    block_id: 'buy-item-name',
                    text: {
                        type: 'plain_text',
                        text: 'Select an item to buy:',
                    },
                    accessory: {
                        type: 'static_select',
                        action_id: 'buy-item-name',
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
                            text: 'Quantity',
                        },
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Quantity',
                    },
                },
            ],
        },
    });
}

export async function handleBuyModalSubmit(client: WebClient, body: SlackViewAction, prices: PriceConglomerate, bagApp: BagApp){
    console.log(JSON.stringify(body.view.state, null, 2));
    const selectedOption = body.view.state.values['buy-item-name']['buy-item-name'].selected_option;
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
    const itemToBuy = ((prices.coreItems as Item[]).concat(prices.sellableRotatingItems)).find((item: Item) => item.name === itemName);
    if(!itemToBuy) {
        client.chat.postEphemeral({
            user: body.user.id,
            channel: process.env.GENSTORE_CHANNEL!,
            text: `I don't have any ${itemName} in stock!`
        });
        return;
    }
    const totalPrice = itemToBuy.buyFromPlayerPrice * Number(quantity);
    console.log(`User ${body.user.id} wants to buy ${quantity} ${itemName} for ${totalPrice} :-gp:`)
    const userInventory = await bagApp.getInventory({
        identityId: body.user.id,
        available: true,
    })
    const userBalance = userInventory.filter((instance: Instance)  => instance.itemId == 'gp').reduce((acc: number, instance: Instance) => acc + (instance.quantity ?? 0), 0);
    if(userBalance < totalPrice) {
        client.chat.postEphemeral({
            channel: process.env.GENSTORE_CHANNEL!,
            user: body.user.id,
            text: `You don't have enough gp to buy ${quantity} ${itemName} :${itemToBuy.tag}:! That costs ${totalPrice} :-gp:, but you only have ${userBalance} :-gp:.`
        });
        return;
    }
    const newBalance = userBalance - totalPrice;

    // get rid of the existing gp in their inventory
    for(const instance of userInventory.filter((instance: Instance) => instance.itemId == 'gp')) {
        await bagApp.deleteInstance({
            instanceId: instance.id!,
        });
        console.log(`Deleted instance ${instance.id} of ${instance.quantity} ${instance.itemId} from user ${body.user.id}'s inventory`)
    } 

    await bagApp.createInstance({ // give back the new gp amount
        identityId: body.user.id,
        itemId: 'gp',
        quantity: newBalance,
        show: false
      });
    await bagApp.createInstance({ // give the item they bought
        identityId: body.user.id,
        itemId: itemToBuy.name,
        quantity: Number(quantity),
    });

    client.chat.postEphemeral({
        user: body.user.id,
        channel: process.env.GENSTORE_CHANNEL!,
        text: `You bought ${quantity} ${itemName} :${itemToBuy.tag}: for ${totalPrice} :-gp:! You now have ${newBalance} :-gp: left.`
    });
}