import { WebClient } from '@slack/web-api';
import yaml from 'js-yaml';

interface Item {
    name: string;
    intendedValue: number;
    variance: number;
    sellToPlayerPrice: number;
    buyFromPlayerPrice: number;
}

export default async function sendUpdate(client: WebClient) {
    // step 1. get items.yaml for new price
    // step 2. calculate random price variances
    // step 3. construct new message
    // step 4. send message to channel
    console.log('Sending update...');

    // step 1
    if(!process.env.ITEMS_LINK) {
        throw new Error('ITEMS_LINK is not defined');
    }   
    const itemsyaml = await fetch(process.env.ITEMS_LINK)
    .then(response => response.text())
    // deconstruct the yaml file
    const items = (yaml.load(itemsyaml) as any).map((item: any) => {
        const varianceSell = Math.floor(Math.random() * item.variance * 2) - item.variance;
        const varianceBuy = Math.floor(Math.random() * item.variance * 2) - item.variance;
        return {
            sellToPlayerPrice: item['genstore_sell_to_player_price'] + varianceSell,
            buyFromPlayerPrice: item['genstore_sell_to_player_price'] + varianceBuy,
            name: item['name'],
            intendedValue: item['intended_value_gp'],
        }
    });

    // step 3

}