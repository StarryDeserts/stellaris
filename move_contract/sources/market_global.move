module stellaris::market_global {

    use stellaris::package_manager;
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_std::smart_vector::{Self, SmartVector};
    use stellaris::fixed_point64::{Self, FixedPoint64};

    struct MarketFactoryConfig has key {
        treasury: address,
        reserve_fee_percent: FixedPoint64,
        override_fee_percent: SmartTable<address, FixedPoint64>,
        permissionless: bool,
        max_reserve_fee_percent: FixedPoint64,
        min_expiry_interval: u64,
        markets: SmartVector<address>,
    }

    fun init_module(_account: &signer) {
        let _max_reserve_fee_percent = fixed_point64::fraction(1, 1);
        let config = MarketFactoryConfig {
            treasury: @stellaris,
            reserve_fee_percent: fixed_point64::from_u128(184467440737095516 as u128),
            override_fee_percent: smart_table::new<address, FixedPoint64>(),
            permissionless: false,
            max_reserve_fee_percent: _max_reserve_fee_percent,
            min_expiry_interval: 86400000,
            markets: smart_vector::empty<address>(),
        };
        move_to(&package_manager::get_signer(), config);
    }

    public fun add(market_address: address) acquires MarketFactoryConfig {
        let config = borrow_global_mut<MarketFactoryConfig>(package_manager::get_resource_address());
        config.markets.push_back(market_address);
    }

    public fun contains(market_address: address) : bool acquires MarketFactoryConfig {
        let config = borrow_global<MarketFactoryConfig>(package_manager::get_resource_address());
        config.markets.contains(&market_address)
    }

    public fun get_min_expiry_interval() : u64 acquires MarketFactoryConfig {
        let config = borrow_global<MarketFactoryConfig>(package_manager::get_resource_address());
        config.min_expiry_interval
    }

    public fun get_reserve_fee_percent(
        market_address: address
    ) : FixedPoint64 acquires MarketFactoryConfig {
        let config = borrow_global<MarketFactoryConfig>(package_manager::get_resource_address());
        // 检查是否存在针对该 `market_id` 的特定费用覆盖设置。
        if (config.override_fee_percent.contains(market_address)) {
        // 如果存在，则借用（borrow）对该覆盖费用值的引用。
        let override_fee = config.override_fee_percent.borrow(
            market_address
        );
        // 返回该覆盖费用的一个副本。
        return *override_fee
        };
        // 如果没有覆盖设置，则返回全局默认的准备金费用。
        config.reserve_fee_percent
    }

    #[view]
    public fun get_all_markets() :vector<address> acquires MarketFactoryConfig {
        let config = borrow_global<MarketFactoryConfig>(package_manager::get_resource_address());
        config.markets.to_vector()
    }

    
}
