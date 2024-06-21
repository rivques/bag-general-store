import yaml from "js-yaml";
import { Item } from "./types";

export default async function calculatePrices(): Promise<Item[]> {
    if(!process.env.ITEMS_LINK) {
        throw new Error('env var ITEMS_LINK is not defined');
    }   
    const itemsyaml = await fetch(process.env.ITEMS_LINK)
    .then(response => response.text())
    // deconstruct the yaml file
    const items: Item[] = (yaml.load(itemsyaml) as any).map((item: any) => {
        const varianceSell = item['genstore_price_variance'] * item['genstore_sell_to_player_price'] * (2 * Math.random() - 1); // take variance% of the sell price and multiply by a random number between -1 and 1
        const varianceBuy = item['genstore_price_variance'] * item['genstore_sell_to_player_price'] * (2 * Math.random() - 1);
        return {
            sellToPlayerPrice: Math.round(item['genstore_sell_to_player_price'] + varianceSell),
            buyFromPlayerPrice: Math.round(item['genstore_sell_to_player_price'] + varianceBuy),
            name: item['name'],
            tag: item['tag'],
            intendedValue: item['intended_value_gp'],
        }
    });
    return items;
}