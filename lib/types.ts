export interface Asset {
  id: string;
  name: string;
  category: string;
  location: string;
  dateRegistered: string;
  dateRemoved?: string;
  rfidUid?: string;
  assetType: string;
  quantity: number;
  assetStatus: string;
  condition: string;
  description?: string;
  createdAt: string;
}
