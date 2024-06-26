interface ItemBase { // these are pretty much Rust-style enums 
    name: string;    // so the typing makes sure that everything has exactly the values it needs
    tag: string;     // and I shouldn't be able to get an undefined anywhere 
    intendedValue: number;
    variance: number;
}

// interface ItemNotForSale extends ItemBase {
//     itemSaleStatus: 'not-for-sale'
// }

export interface CoreItem extends ItemBase {
    itemSaleStatus: 'core',
    sellToPlayerPrice: number;
    buyFromPlayerPrice: number;
    baseSellToPlayerPrice: number;
    baseBuyFromPlayerPrice: number;
}

export interface SellableRotatingItem extends ItemBase {
    itemSaleStatus: 'sellable-rotating',
    sellToPlayerPrice: number;
    buyFromPlayerPrice: number;
    baseSellToPlayerPrice: number;
    baseBuyFromPlayerPrice: number;
}

export interface BuyOnlyRotatingItem extends ItemBase {
    itemSaleStatus: 'buyonly-rotating',
    buyFromPlayerPrice: number;
}

export type Item = CoreItem | SellableRotatingItem | BuyOnlyRotatingItem;

export interface PriceConglomerate {
    coreItems: CoreItem[];
    sellableRotatingItems: SellableRotatingItem[];
    buyOnlyRotatingItems: BuyOnlyRotatingItem[];
}