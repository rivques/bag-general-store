import { RespondFn, SlashCommand } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { Item } from "./types";
import { App as BagApp, Instance } from "@hackclub/bag";

export default async function genstoreBuy(body: SlashCommand, client: WebClient, prices: Item[], bagApp: BagApp, respond: RespondFn) {
    // make sure channel is correct
    if(body.channel_id !== process.env.GENSTORE_CHANNEL) {
        respond({
            response_type: 'ephemeral',
            text: `Please use the <#${process.env.GENSTORE_CHANNEL}> channel to buy items!`
        });
        return;
    }
    let [itemName, quantity] = body.text.split(' ');
    const itemToBuy = prices.filter((item) => process.env.ITEMS_TO_STOCK!.split(',').includes(item.name)).find((item: Item) => item.name.toLowerCase() === itemName.toLowerCase());
    if(!itemToBuy) {
        client.chat.postEphemeral({
            user: body.user_id,
            channel: body.channel_id,
            text: `I don't have any ${itemName} in stock!`
        });
        return;
    }
    if (!quantity){
        quantity = "1";
    }
    const totalPrice = itemToBuy.buyFromPlayerPrice * Number(quantity);
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
    console.log(`User ${body.user_id} wants to buy ${quantity} ${itemName} for ${totalPrice} :-gp:`)
    const userInventory = await bagApp.getInventory({
        identityId: body.user_id,
        available: true,
    })
    const userBalance = userInventory.filter((instance: Instance)  => instance.itemId == 'gp').reduce((acc: number, instance: Instance) => acc + (instance.quantity ?? 0), 0);
    if(userBalance < totalPrice) {
        client.chat.postEphemeral({
            channel: body.channel_id,
            user: body.user_id,
            text: `You don't have enough gp to buy ${quantity} ${itemName} :${itemToBuy.tag}:! That costs ${totalPrice} :-gp:, but you only have ${userBalance} :-gp:.`
        });
        return;
    }
    const newBalance = userBalance - totalPrice;

    // get rid of the existing gp in their inventory
    for(const instance of userInventory.filter((instance: Instance) => instance.itemId == 'gp')){
        if(!instance.id) {
            console.log(`instance id is undefined when trying to remove gp instances while selling ${quantity} ${itemName} to user ${body.user_id}!`)
            return;
        };
        await bagApp.deleteInstance({
            instanceId: instance.id,
        });
        console.log(`Deleted instance ${instance.id} of ${instance.quantity} ${instance.itemId} from user ${body.user_id}'s inventory`)
    } 

    await bagApp.createInstance({ // give back the new gp amount
        identityId: body.user_id,
        itemId: 'gp',
        quantity: newBalance,
        show: false
      });
    await bagApp.createInstance({ // give the item they bought
        identityId: body.user_id,
        itemId: itemToBuy.name,
        quantity: Number(quantity),
    });

    client.chat.postEphemeral({
        user: body.user_id,
        channel: body.channel_id,
        text: `You bought ${quantity} ${itemName} :${itemToBuy.tag}: for ${totalPrice} :-gp:! You now have ${newBalance} :-gp: left.`
    });
}