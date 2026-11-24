import pricingData from '../data/aws-pricing.json';

export interface RegionInfo {
  name: string;
  multiplier: number;
}

export class PricingService {
  /**
   * Returns complete bundled regional AWS pricing dataset
   */
  public static getPricingData() {
    return pricingData;
  }

  /**
   * Returns regional multiplier for cost calculation
   */
  public static getRegionMultiplier(region: string): number {
    const regions = pricingData.regions as Record<string, RegionInfo>;
    return regions[region]?.multiplier ?? 1.0;
  }

  /**
   * Validates if a given AWS region is supported
   */
  public static isSupportedRegion(region: string): boolean {
    return Object.prototype.hasOwnProperty.call(pricingData.regions, region);
  }
}