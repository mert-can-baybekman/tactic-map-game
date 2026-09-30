/**
 * Mathematical Utility Curves & Desirability Scoring Functions
 * Replaces hardcoded if/else trees with continuous mathematical utility response curves.
 */

export class UtilityMath {
  /**
   * Clamps value strictly between min and max
   */
  public static clamp(val: number, min: number = 0.0, max: number = 1.0): number {
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Sigmoid / Logistic response curve
   * Ideal for risk perception and threshold triggers
   */
  public static sigmoid(x: number, midpoint: number = 0.5, steepness: number = 10): number {
    return 1.0 / (1.0 + Math.exp(-steepness * (x - midpoint)));
  }

  /**
   * Diminishing Returns curve (Logarithmic / Square Root)
   * Ideal for gold valuation: 100 gold is massive to an impoverished realm, minor to a rich one.
   */
  public static diminishingReturns(currentGold: number, targetGold: number = 500): number {
    if (currentGold <= 0) return 0.0;
    return this.clamp(Math.log10(1.0 + currentGold) / Math.log10(1.0 + targetGold * 2));
  }

  /**
   * Linear normalization
   */
  public static linearNormalize(val: number, min: number, max: number): number {
    if (max <= min) return 0.0;
    return this.clamp((val - min) / (max - min));
  }

  /**
   * Multi-criteria utility aggregator (Weighted Geometric Mean)
   * Prevents an action with a catastrophic sub-metric from executing
   */
  public static weightedGeometricMean(scores: number[], weights: number[]): number {
    if (scores.length === 0 || scores.length !== weights.length) return 0.0;

    let totalWeight = 0;
    for (const w of weights) totalWeight += w;
    if (totalWeight <= 0) return 0.0;

    let product = 1.0;
    for (let i = 0; i < scores.length; i++) {
      const s = Math.max(0.001, scores[i]);
      product *= Math.pow(s, weights[i] / totalWeight);
    }

    return this.clamp(product);
  }
}
