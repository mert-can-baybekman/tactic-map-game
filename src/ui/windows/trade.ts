/**
 * Dynamic Market Hub & Trade Graph Window
 * Displays Local Market Volume, Trade Share, and the Supply/Demand Price Ticket Grid.
 */

import { BaseUIWindow, VirtualListRenderer } from '../base.ts';

export interface TradeGoodRow {
  goodId: string;
  name: string;
  icon: string;
  localSupplyUnits: number;
  localDemandUnits: number;
  marketClearingPrice: number;
  basePrice: number;
  priceTrend: 'rising' | 'falling' | 'stable';
  isDeficit: boolean;
}

export class TradeWindow extends BaseUIWindow {
  public hubName: string = 'London Hub (English Channel Basin)';
  public marketVolumeDucats: number = 1845.0;
  public domesticTradeSharePercent: number = 74.5;
  public blockadeEffectivenessPercent: number = 0.0;
  public virtualList: VirtualListRenderer<TradeGoodRow> = new VirtualListRenderer<TradeGoodRow>(38, 4);

  public goods: TradeGoodRow[] = [
    { goodId: 'grain', name: 'Grain & Cereals', icon: '🌾', localSupplyUnits: 180, localDemandUnits: 130, marketClearingPrice: 2.1, basePrice: 2.5, priceTrend: 'falling', isDeficit: false },
    { goodId: 'wool', name: 'Raw Fleece & Wool', icon: '🐑', localSupplyUnits: 95, localDemandUnits: 70, marketClearingPrice: 3.2, basePrice: 3.5, priceTrend: 'stable', isDeficit: false },
    { goodId: 'cloth', name: 'Finished Flemish Cloth', icon: '🧵', localSupplyUnits: 30, localDemandUnits: 55, marketClearingPrice: 9.8, basePrice: 8.0, priceTrend: 'rising', isDeficit: true },
    { goodId: 'iron', name: 'Bog & Mined Iron', icon: '⛏️', localSupplyUnits: 45, localDemandUnits: 50, marketClearingPrice: 6.8, basePrice: 6.0, priceTrend: 'rising', isDeficit: true },
    { goodId: 'timber', name: 'Shipwright Hardwood', icon: '🌲', localSupplyUnits: 65, localDemandUnits: 60, marketClearingPrice: 4.1, basePrice: 4.0, priceTrend: 'stable', isDeficit: false },
    { goodId: 'weapons', name: 'Longbows & Armaments', icon: '⚔️', localSupplyUnits: 25, localDemandUnits: 40, marketClearingPrice: 22.5, basePrice: 18.0, priceTrend: 'rising', isDeficit: true },
    { goodId: 'copper', name: 'Smelted Copper', icon: '🥉', localSupplyUnits: 20, localDemandUnits: 20, marketClearingPrice: 5.5, basePrice: 5.5, priceTrend: 'stable', isDeficit: false },
    { goodId: 'fine_wine', name: 'Bordeaux Fine Wine', icon: '🍷', localSupplyUnits: 40, localDemandUnits: 35, marketClearingPrice: 12.5, basePrice: 14.0, priceTrend: 'falling', isDeficit: false },
    { goodId: 'fish', name: 'Salted Herring', icon: '🐟', localSupplyUnits: 110, localDemandUnits: 80, marketClearingPrice: 1.8, basePrice: 2.0, priceTrend: 'falling', isDeficit: false },
    { goodId: 'salt', name: 'Rock Salt', icon: '🧂', localSupplyUnits: 50, localDemandUnits: 60, marketClearingPrice: 3.4, basePrice: 3.0, priceTrend: 'rising', isDeficit: true }
  ];

  constructor() {
    super('window_trade', 'Market Center & Trade Flow Graph', '⚖️');
  }

  public setBlockaded(blockaded: boolean): void {
    this.blockadeEffectivenessPercent = blockaded ? 85.0 : 0.0;
    if (blockaded) {
      // Input costs spike
      const timber = this.goods.find(g => g.goodId === 'timber');
      if (timber) { timber.marketClearingPrice = 14.2; timber.priceTrend = 'rising'; timber.isDeficit = true; }
      const weapons = this.goods.find(g => g.goodId === 'weapons');
      if (weapons) { weapons.marketClearingPrice = 36.5; weapons.priceTrend = 'rising'; weapons.isDeficit = true; }
    } else {
      const timber = this.goods.find(g => g.goodId === 'timber');
      if (timber) { timber.marketClearingPrice = 4.1; timber.priceTrend = 'stable'; timber.isDeficit = false; }
      const weapons = this.goods.find(g => g.goodId === 'weapons');
      if (weapons) { weapons.marketClearingPrice = 22.5; weapons.priceTrend = 'rising'; }
    }
    this.markDirty();
  }

  protected onSimulationTick(simulationData: any): void {
    if (simulationData?.channelBlockaded !== undefined) {
      this.setBlockaded(simulationData.channelBlockaded);
    }
  }

  public render(simData: any): string {
    const slice = this.virtualList.computeSlice(this.goods, 400, 0);

    const rowsHtml = slice.visibleItems.map(({ item: g }) => {
      const trendIcon = g.priceTrend === 'rising' ? '🔺' : g.priceTrend === 'falling' ? '🔻' : '➖';
      const trendClass = g.priceTrend === 'rising' ? 'pos' : g.priceTrend === 'falling' ? 'neg' : '';

      return `
        <div class="trade-grid-row ${g.isDeficit ? 'deficit-row' : ''}">
          <div class="tg-cell tg-good">
            <span>${g.icon}</span>
            <strong>${g.name}</strong>
          </div>
          <div class="tg-cell tg-supply">${g.localSupplyUnits} units</div>
          <div class="tg-cell tg-demand">${g.localDemandUnits} units</div>
          <div class="tg-cell tg-price">
            <strong>${g.marketClearingPrice.toFixed(2)} D</strong>
            <span class="tg-trend ${trendClass}">${trendIcon}</span>
          </div>
          <div class="tg-cell tg-balance">
            ${g.isDeficit ? `
              <span class="deficit-badge">Deficit (-${g.localDemandUnits - g.localSupplyUnits})</span>
            ` : `
              <span class="surplus-badge">Surplus (+${g.localSupplyUnits - g.localDemandUnits})</span>
            `}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ui-window-content trade-window">
        <div class="trade-hub-overview">
          <div class="hub-header">
            <h3>📍 ${this.hubName}</h3>
            <span class="hub-tier-badge">Major Channel Entrepôt</span>
          </div>
          <div class="hub-metric-deck">
            <div class="hub-metric-card">
              <span>Total Market Volume</span>
              <strong>${this.marketVolumeDucats.toFixed(1)} Ducats</strong>
            </div>
            <div class="hub-metric-card">
              <span>Domestic Merchant Share</span>
              <strong style="color: #34d399;">${this.domesticTradeSharePercent.toFixed(1)}%</strong>
            </div>
            <div class="hub-metric-card">
              <span>Naval Blockade Interdiction</span>
              <strong style="color: ${this.blockadeEffectivenessPercent > 0 ? '#ef4444' : '#34d399'};">
                ${this.blockadeEffectivenessPercent.toFixed(1)}%
              </strong>
            </div>
          </div>
        </div>

        <div class="trade-goods-table-container">
          <div class="trade-grid-header">
            <span class="tg-cell tg-good">Commodity</span>
            <span class="tg-cell tg-supply">Local Supply</span>
            <span class="tg-cell tg-demand">Local Demand</span>
            <span class="tg-cell tg-price">Clearing Price</span>
            <span class="tg-cell tg-balance">Flow Status</span>
          </div>
          <div class="trade-virtual-scroll">
            ${rowsHtml}
          </div>
        </div>
      </div>
    `;
  }
}
