export interface PointsPackage {
  id: string
  points: number
  priceYuan: number
  priceFen: number
  productCode: string
}

/** 星积分充值档位（与设计稿一致） */
export const POINTS_PACKAGES: PointsPackage[] = [
  { id: 'points_1000', points: 1000, priceYuan: 50, priceFen: 5000, productCode: 'POINTS_1000' },
  { id: 'points_2000', points: 2000, priceYuan: 100, priceFen: 10000, productCode: 'POINTS_2000' },
  { id: 'points_4200', points: 4200, priceYuan: 200, priceFen: 20000, productCode: 'POINTS_4200' },
  { id: 'points_6500', points: 6500, priceYuan: 300, priceFen: 30000, productCode: 'POINTS_6500' },
  { id: 'points_10900', points: 10900, priceYuan: 500, priceFen: 50000, productCode: 'POINTS_10900' },
  { id: 'points_22000', points: 22000, priceYuan: 1000, priceFen: 100000, productCode: 'POINTS_22000' },
  { id: 'points_45000', points: 45000, priceYuan: 2000, priceFen: 200000, productCode: 'POINTS_45000' },
  { id: 'points_69000', points: 69000, priceYuan: 3000, priceFen: 300000, productCode: 'POINTS_69000' },
]
