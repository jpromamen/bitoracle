import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    OP_NET,
    Revert,
    SafeMath,
    encodeSelector,
} from '@btc-vision/btc-runtime/runtime';
import { StoredMapU256 } from '@btc-vision/btc-runtime/runtime/storage/maps/StoredMapU256';

// =============================================================================
// Storage Pointer Allocation
// =============================================================================
const ownerPointer: u16 = Blockchain.nextPointer;
const marketCountPointer: u16 = Blockchain.nextPointer;

// Per-market storage (keyed by marketId)
const marketTitlePointer: u16 = Blockchain.nextPointer;       // truncated title hash
const marketDeadlinePointer: u16 = Blockchain.nextPointer;    // block deadline
const marketResolvedPointer: u16 = Blockchain.nextPointer;    // 0=open, 1=YES, 2=NO, 3=cancelled
const marketYesPoolPointer: u16 = Blockchain.nextPointer;     // total YES bets
const marketNoPoolPointer: u16 = Blockchain.nextPointer;      // total NO bets
const marketCategoryPointer: u16 = Blockchain.nextPointer;    // 0=crypto 1=sports 2=politics 3=other
const marketCreatorPointer: u16 = Blockchain.nextPointer;     // creator address as u256

// Per-user-per-market (keyed by hash of userAddr + marketId)
const userYesBetPointer: u16 = Blockchain.nextPointer;
const userNoBetPointer: u16 = Blockchain.nextPointer;
const userClaimedPointer: u16 = Blockchain.nextPointer;

// Protocol fee: 2% (200 basis points)
const FEE_BPS: u64 = 200;
const BPS_BASE: u64 = 10000;

const GLOBAL_KEY: u256 = u256.Zero;

@final
export class PredictionMarket extends OP_NET {

    private readonly ownerMap: StoredMapU256;
    private readonly marketCountMap: StoredMapU256;

    private readonly marketTitle: StoredMapU256;
    private readonly marketDeadline: StoredMapU256;
    private readonly marketResolved: StoredMapU256;
    private readonly marketYesPool: StoredMapU256;
    private readonly marketNoPool: StoredMapU256;
    private readonly marketCategory: StoredMapU256;
    private readonly marketCreator: StoredMapU256;

    private readonly userYesBet: StoredMapU256;
    private readonly userNoBet: StoredMapU256;
    private readonly userClaimed: StoredMapU256;

    public constructor() {
        super();
        this.ownerMap = new StoredMapU256(ownerPointer);
        this.marketCountMap = new StoredMapU256(marketCountPointer);
        this.marketTitle = new StoredMapU256(marketTitlePointer);
        this.marketDeadline = new StoredMapU256(marketDeadlinePointer);
        this.marketResolved = new StoredMapU256(marketResolvedPointer);
        this.marketYesPool = new StoredMapU256(marketYesPoolPointer);
        this.marketNoPool = new StoredMapU256(marketNoPoolPointer);
        this.marketCategory = new StoredMapU256(marketCategoryPointer);
        this.marketCreator = new StoredMapU256(marketCreatorPointer);
        this.userYesBet = new StoredMapU256(userYesBetPointer);
        this.userNoBet = new StoredMapU256(userNoBetPointer);
        this.userClaimed = new StoredMapU256(userClaimedPointer);
    }

    // ─── Deployment ────────────────────────────────────────────────────────────

    public override onDeployment(_calldata: Calldata): void {
        this.ownerMap.set(GLOBAL_KEY, this._addressToU256(Blockchain.tx.origin));
        this.marketCountMap.set(GLOBAL_KEY, u256.Zero);
    }

    // ─── Create Market ─────────────────────────────────────────────────────────

    @method({ name: 'titleHash', type: ABIDataTypes.UINT256 }, { name: 'deadlineBlocks', type: ABIDataTypes.UINT64 }, { name: 'category', type: ABIDataTypes.UINT8 })
    @returns({ name: 'marketId', type: ABIDataTypes.UINT256 })
    public createMarket(calldata: Calldata): BytesWriter {
        const titleHash = calldata.readU256();
        const deadlineBlocks = calldata.readU64();
        const category = calldata.readU8();

        if (deadlineBlocks < 10) throw new Revert('Deadline too short');

        const marketId = this.marketCountMap.get(GLOBAL_KEY);
        const deadline = u256.fromU64(Blockchain.block.number + deadlineBlocks);

        this.marketTitle.set(marketId, titleHash);
        this.marketDeadline.set(marketId, deadline);
        this.marketResolved.set(marketId, u256.Zero); // open
        this.marketYesPool.set(marketId, u256.Zero);
        this.marketNoPool.set(marketId, u256.Zero);
        this.marketCategory.set(marketId, u256.fromU8(category));
        this.marketCreator.set(marketId, this._addressToU256(Blockchain.tx.sender));

        // increment count
        this.marketCountMap.set(GLOBAL_KEY, SafeMath.add(marketId, u256.One));

        const writer = new BytesWriter(32);
        writer.writeU256(marketId);
        return writer;
    }

    // ─── Bet YES ───────────────────────────────────────────────────────────────

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 }, { name: 'tokenAddress', type: ABIDataTypes.ADDRESS }, { name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'newYesPool', type: ABIDataTypes.UINT256 })
    public betYes(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const token = calldata.readAddress();
        const amount = calldata.readU256();

        this._validateBet(marketId, amount);

        // Transfer tokens to contract
        this._transferFrom(token, Blockchain.tx.sender, Blockchain.contractAddress, amount);

        // Apply fee
        const fee = this._calcFee(amount);
        const netAmount = SafeMath.sub(amount, fee);

        const userKey = this._userMarketKey(Blockchain.tx.sender, marketId);
        this.userYesBet.set(userKey, SafeMath.add(this.userYesBet.get(userKey), netAmount));

        const newPool = SafeMath.add(this.marketYesPool.get(marketId), netAmount);
        this.marketYesPool.set(marketId, newPool);

        const writer = new BytesWriter(32);
        writer.writeU256(newPool);
        return writer;
    }

    // ─── Bet NO ────────────────────────────────────────────────────────────────

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 }, { name: 'tokenAddress', type: ABIDataTypes.ADDRESS }, { name: 'amount', type: ABIDataTypes.UINT256 })
    @returns({ name: 'newNoPool', type: ABIDataTypes.UINT256 })
    public betNo(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const token = calldata.readAddress();
        const amount = calldata.readU256();

        this._validateBet(marketId, amount);

        this._transferFrom(token, Blockchain.tx.sender, Blockchain.contractAddress, amount);

        const fee = this._calcFee(amount);
        const netAmount = SafeMath.sub(amount, fee);

        const userKey = this._userMarketKey(Blockchain.tx.sender, marketId);
        this.userNoBet.set(userKey, SafeMath.add(this.userNoBet.get(userKey), netAmount));

        const newPool = SafeMath.add(this.marketNoPool.get(marketId), netAmount);
        this.marketNoPool.set(marketId, newPool);

        const writer = new BytesWriter(32);
        writer.writeU256(newPool);
        return writer;
    }

    // ─── Resolve Market (owner or creator) ────────────────────────────────────

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 }, { name: 'outcome', type: ABIDataTypes.UINT8 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    public resolve(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const outcome = calldata.readU8(); // 1=YES, 2=NO, 3=CANCELLED

        const caller = Blockchain.tx.sender;
        const owner = this._u256ToAddress(this.ownerMap.get(GLOBAL_KEY));
        const creator = this._u256ToAddress(this.marketCreator.get(marketId));

        if (!caller.equals(owner) && !caller.equals(creator)) throw new Revert('Not authorized');

        const current = this.marketResolved.get(marketId);
        if (!current.isZero()) throw new Revert('Already resolved');

        const deadline = this.marketDeadline.get(marketId).toU64();
        if (Blockchain.block.number < deadline) throw new Revert('Market still open');

        if (outcome < 1 || outcome > 3) throw new Revert('Invalid outcome');

        this.marketResolved.set(marketId, u256.fromU8(outcome));

        const writer = new BytesWriter(1);
        writer.writeBoolean(true);
        return writer;
    }

    // ─── Claim Winnings ────────────────────────────────────────────────────────

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 }, { name: 'tokenAddress', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'payout', type: ABIDataTypes.UINT256 })
    public claim(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const token = calldata.readAddress();

        const user = Blockchain.tx.sender;
        const userKey = this._userMarketKey(user, marketId);

        if (!this.userClaimed.get(userKey).isZero()) throw new Revert('Already claimed');

        const outcome = this.marketResolved.get(marketId).toU64();
        if (outcome === 0) throw new Revert('Market not resolved');

        let payout = u256.Zero;

        if (outcome === 3) {
            // Cancelled: full refund
            payout = SafeMath.add(this.userYesBet.get(userKey), this.userNoBet.get(userKey));
        } else {
            const yesPool = this.marketYesPool.get(marketId);
            const noPool = this.marketNoPool.get(marketId);
            const totalPool = SafeMath.add(yesPool, noPool);

            if (outcome === 1) {
                // YES wins
                const userBet = this.userYesBet.get(userKey);
                if (!userBet.isZero() && !yesPool.isZero()) {
                    payout = SafeMath.div(SafeMath.mul(userBet, totalPool), yesPool);
                }
            } else {
                // NO wins
                const userBet = this.userNoBet.get(userKey);
                if (!userBet.isZero() && !noPool.isZero()) {
                    payout = SafeMath.div(SafeMath.mul(userBet, totalPool), noPool);
                }
            }
        }

        if (payout.isZero()) throw new Revert('Nothing to claim');

        this.userClaimed.set(userKey, u256.One);
        this._transfer(token, user, payout);

        const writer = new BytesWriter(32);
        writer.writeU256(payout);
        return writer;
    }

    // ─── View: Market Info ─────────────────────────────────────────────────────

    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'titleHash', type: ABIDataTypes.UINT256 },
        { name: 'deadline', type: ABIDataTypes.UINT64 },
        { name: 'resolved', type: ABIDataTypes.UINT8 },
        { name: 'yesPool', type: ABIDataTypes.UINT256 },
        { name: 'noPool', type: ABIDataTypes.UINT256 },
        { name: 'category', type: ABIDataTypes.UINT8 },
    )
    public getMarket(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const writer = new BytesWriter(32 + 8 + 1 + 32 + 32 + 1);
        writer.writeU256(this.marketTitle.get(marketId));
        writer.writeU64(this.marketDeadline.get(marketId).toU64());
        writer.writeU8(this.marketResolved.get(marketId).toU64() as u8);
        writer.writeU256(this.marketYesPool.get(marketId));
        writer.writeU256(this.marketNoPool.get(marketId));
        writer.writeU8(this.marketCategory.get(marketId).toU64() as u8);
        return writer;
    }

    // ─── View: User Position ───────────────────────────────────────────────────

    @method({ name: 'user', type: ABIDataTypes.ADDRESS }, { name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'yesBet', type: ABIDataTypes.UINT256 },
        { name: 'noBet', type: ABIDataTypes.UINT256 },
        { name: 'claimed', type: ABIDataTypes.BOOL },
    )
    public getUserPosition(calldata: Calldata): BytesWriter {
        const user = calldata.readAddress();
        const marketId = calldata.readU256();
        const userKey = this._userMarketKey(user, marketId);

        const writer = new BytesWriter(32 + 32 + 1);
        writer.writeU256(this.userYesBet.get(userKey));
        writer.writeU256(this.userNoBet.get(userKey));
        writer.writeBoolean(!this.userClaimed.get(userKey).isZero());
        return writer;
    }

    // ─── View: Market Count ────────────────────────────────────────────────────

    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    public getMarketCount(_: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this.marketCountMap.get(GLOBAL_KEY));
        return writer;
    }

    // ─── Internal Helpers ──────────────────────────────────────────────────────

    private _validateBet(marketId: u256, amount: u256): void {
        if (amount.isZero()) throw new Revert('Amount must be > 0');
        const resolved = this.marketResolved.get(marketId);
        if (!resolved.isZero()) throw new Revert('Market resolved');
        const deadline = this.marketDeadline.get(marketId).toU64();
        if (Blockchain.block.number >= deadline) throw new Revert('Market expired');
    }

    private _calcFee(amount: u256): u256 {
        return SafeMath.div(
            SafeMath.mul(amount, u256.fromU64(FEE_BPS)),
            u256.fromU64(BPS_BASE),
        );
    }

    private _userMarketKey(user: Address, marketId: u256): u256 {
        // Simple composite key: XOR user bytes with marketId
        const userAsU256 = this._addressToU256(user);
        return SafeMath.add(userAsU256, SafeMath.mul(marketId, u256.fromU64(1000000007)));
    }

    private _transferFrom(token: Address, from: Address, to: Address, amount: u256): void {
        const cd = new BytesWriter(100);
        cd.writeSelector(encodeSelector('transferFrom(address,address,uint256)'));
        cd.writeAddress(from);
        cd.writeAddress(to);
        cd.writeU256(amount);
        const result = Blockchain.call(token, cd);
        if (!result.readBoolean()) throw new Revert('TransferFrom failed');
    }

    private _transfer(token: Address, to: Address, amount: u256): void {
        const cd = new BytesWriter(68);
        cd.writeSelector(encodeSelector('transfer(address,uint256)'));
        cd.writeAddress(to);
        cd.writeU256(amount);
        const result = Blockchain.call(token, cd);
        if (!result.readBoolean()) throw new Revert('Transfer failed');
    }

    protected _addressToU256(addr: Address): u256 {
        return u256.fromUint8ArrayBE(addr);
    }

    protected _u256ToAddress(val: u256): Address {
        if (val.isZero()) return Address.zero();
        return Address.fromUint8Array(val.toUint8Array(true));
    }
}
