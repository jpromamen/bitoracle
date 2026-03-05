import { PredictionMarket } from './PredictionMarket';

export function defineContract(): void {
    const contract = new PredictionMarket();
    contract.defineContract();
}
