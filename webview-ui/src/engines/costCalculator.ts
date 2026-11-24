export interface NodeConfig {
  instanceType?: string;
  storageGb?: number;
  volumeType?: 'gp2' | 'gp3';
  hours?: number;
}

export function calculateNodeMonthlyCost(
  service: string,
  config: NodeConfig,
  region: string,
  pricing: any
): number {
  if (!pricing) return 0;
  const multiplier = pricing.regions?.[region]?.multiplier ?? 1.0;
  const hours = config.hours ?? 730;
  let base = 0;

  if (service === 'EC2') {
    const hourly = pricing.services.EC2.instances[config.instanceType || 't3.medium'] ?? 0.0416;
    const storageRate = pricing.services.EC2.storagePerGb[config.volumeType || 'gp3'] ?? 0.08;
    base = hourly * hours + (config.storageGb || 30) * storageRate;
  } else if (service === 'RDS') {
    const hourly = pricing.services.RDS.instances[config.instanceType || 'db.t3.medium'] ?? 0.068;
    const storageRate = pricing.services.RDS.storagePerGb[config.volumeType || 'gp3'] ?? 0.092;
    base = hourly * hours + (config.storageGb || 50) * storageRate;
  } else if (service === 'ALB') {
    base = pricing.services.ALB.baseHourly * hours;
  } else if (service === 'NAT') {
    base = pricing.services.NAT.baseHourly * hours;
  } else if (service === 'S3') {
    base = (config.storageGb || 100) * pricing.services.S3.storagePerGb;
  } else if (service === 'CloudFront') {
    base = pricing.services.CloudFront.baseMonthly;
  }

  return Number((base * multiplier).toFixed(2));
}