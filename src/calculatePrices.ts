import yaml from "js-yaml";
import { BuyOnlyRotatingItem, CoreItem, Item, PriceConglomerate, SellableRotatingItem } from "./types";

interface YamlItem {
    name: string;
    artist: string;
    description: string;
    tag: string;
    intended_value_gp: number;
    genstore_price_variance: number;
    genstore_sell_to_player_price: number;
    genstore_buy_from_player_price: number;
}

export async function rerollPrices(oldPrices: PriceConglomerate): Promise<PriceConglomerate> {
    // just redo the prices wrt variance, don't need to change the items
    return {
        coreItems: oldPrices.coreItems.map((item: CoreItem) => {
            return {
                ...item,
                sellToPlayerPrice: Math.round(item.baseSellToPlayerPrice + Math.floor(Math.random() * item.variance * 2) - item.variance),
                buyFromPlayerPrice: Math.round(item.baseBuyFromPlayerPrice + Math.floor(Math.random() * item.variance * 2) - item.variance)
            }
        }),
        sellableRotatingItems: oldPrices.sellableRotatingItems.map((item: SellableRotatingItem) => {
            return {
                ...item,
                sellToPlayerPrice: Math.round(item.baseSellToPlayerPrice + Math.floor(Math.random() * item.variance * 2) - item.variance),
                buyFromPlayerPrice: Math.round(item.baseBuyFromPlayerPrice + Math.floor(Math.random() * item.variance * 2) - item.variance)
            }
        }),
        buyOnlyRotatingItems: oldPrices.buyOnlyRotatingItems.map((item: BuyOnlyRotatingItem) => {
            return {
                ...item,
                buyFromPlayerPrice: Math.round(item.intendedValue + Math.floor(Math.random() * item.variance * 2) - item.variance)
            }
        })
    }
}


export async function rerollItems(): Promise<PriceConglomerate> {
    // TODO: don't stock noncraftable/nontradable items
    validateEnvVars();
    const yamlString = await fetch(process.env.ITEMS_LINK!)
    .then(response => response.text())
    // deconstruct the yaml file
    const filterRegex = process.env.EXCLUDE_REGEX!
    const yamlItems: YamlItem[] = (yaml.load(yamlString) as YamlItem[]).filter((item: YamlItem) => !item.name.match(filterRegex));
    // figure out tiering:
    // sort by intended value
    // split into 3 tiers: core (from CORE_ITEMS), mid (items between MID_FLOOR and MID_CEILING), and high (items above MID_CEILING)
    // then, stock all core items, a random NUM_SELLABLE_ROTATING from mid, and a random NUM_BUYONLY_ROTATING from high
    // then, calculate the prices for each item, with variance
    // then, return the conglomerate
    const coreItems = yamlItems.filter((item: YamlItem) => process.env.CORE_ITEMS!.split(',').includes(item.name));
    const midItems = yamlItems.filter((item: YamlItem) => item.intended_value_gp >= Number(process.env.MID_FLOOR) && item.intended_value_gp <= Number(process.env.MID_CEILING));
    const highItems = yamlItems.filter((item: YamlItem) => item.intended_value_gp >= Number(process.env.MID_FLOOR));
    const numSellableRotating = Number(process.env.NUM_SELLABLE_ROTATING);
    const numBuyOnlyRotating = Number(process.env.NUM_BUYONLY_ROTATING);

    const sellableRotatingItems: YamlItem[] = [];
    const buyOnlyRotatingItems: YamlItem[] = [];
    for(let i = 0; i < numSellableRotating; i++) {
        const randomIndex = Math.floor(Math.random() * midItems.length);
        const randomItem = midItems[randomIndex];
        sellableRotatingItems.push(randomItem);
        midItems.splice(randomIndex, 1);
    }
    for(let i = 0; i < numBuyOnlyRotating; i++) {
        const randomIndex = Math.floor(Math.random() * highItems.length);
        const randomItem = highItems[randomIndex];
        buyOnlyRotatingItems.push(randomItem!);
        highItems.splice(randomIndex!, 1);
    }

    return {
        coreItems: coreItems.map((item: YamlItem) => {
            return {
                name: item.name,
                tag: item.tag,
                intendedValue: item.intended_value_gp,
                variance: item.genstore_price_variance,
                itemSaleStatus: 'core',
                baseSellToPlayerPrice: item.genstore_sell_to_player_price,
                baseBuyFromPlayerPrice: item.genstore_buy_from_player_price,
                sellToPlayerPrice: Math.round(item.genstore_sell_to_player_price + Math.floor(Math.random() * item.genstore_price_variance * 2) - item.genstore_price_variance),
                buyFromPlayerPrice: Math.round(item.genstore_buy_from_player_price + Math.floor(Math.random() * item.genstore_price_variance * 2) - item.genstore_price_variance)
            }
        }),
        sellableRotatingItems: sellableRotatingItems.map((item: YamlItem) => {
            return {
                name: item.name,
                tag: item.tag,
                intendedValue: item.intended_value_gp,
                variance: item.genstore_price_variance,
                itemSaleStatus: 'sellable-rotating',
                baseSellToPlayerPrice: item.genstore_sell_to_player_price,
                baseBuyFromPlayerPrice: item.genstore_buy_from_player_price,
                sellToPlayerPrice: Math.round(item.genstore_sell_to_player_price + Math.floor(Math.random() * item.genstore_price_variance * 2) - item.genstore_price_variance),
                buyFromPlayerPrice: Math.round(item.genstore_buy_from_player_price + Math.floor(Math.random() * item.genstore_price_variance * 2) - item.genstore_price_variance)
            }
        }),
        buyOnlyRotatingItems: buyOnlyRotatingItems.map((item: YamlItem) => {
            return {
                name: item.name,
                tag: item.tag,
                intendedValue: item.intended_value_gp,
                variance: item.genstore_price_variance,
                itemSaleStatus: 'buyonly-rotating',
                buyFromPlayerPrice: Math.round(item.intended_value_gp + Math.floor(Math.random() * item.genstore_price_variance * 2) - item.genstore_price_variance)     // high-value items don't get the selling debuff
            }
        })
    }
}
    
function validateEnvVars() {
    const envVars = [
        'CORE_ITEMS',
        'MID_FLOOR',
        'MID_CEILING',
        'NUM_SELLABLE_ROTATING',
        'NUM_BUYONLY_ROTATING',
        'ITEMS_LINK',
        'EXCLUDE_REGEX'
    ];
    envVars.forEach((envVar) => {
        if(!process.env[envVar]) {
            throw new Error(`env var ${envVar} is not defined`);
        }
    });
}