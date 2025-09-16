module stellaris::oracle {
    use std::error;
    use aptos_std::smart_table;
    use aptos_std::smart_table::SmartTable;
    use aptos_framework::timestamp;
    use stellaris::package_manager;
    use data_feeds::router::{Self as chainlink_router};
    use data_feeds::registry::{Self as chainlink};

    const I192_MAX: u256 = 3138550867693340381917894711603833208051177722232017256447; // 2^191 - 1

    const E_EMPTY_FEED_ID: u64 = 1;
    const E_NO_FEED_EXISTS: u64 = 2;
    const E_BENCHMARK_MISMATCH: u64 = 3;
    const E_NEGATIVE_PRICE: u64 = 4;
    const E_ZERO_PRICE: u64 = 5;
    const E_ASSET_NOT_REGISTERED: u64 = 6;
    const E_TIMESTAMP_IN_FUTURE: u64 = 7;

    struct PriceOracleData has key {
        /// @dev Mapping of asset addresses to their feed IDs
        asset_feed_ids: SmartTable<address, vector<u8>>,
    }

    fun init_module(account: &signer) {



        move_to(
            &package_manager::get_signer(),
            PriceOracleData {
                asset_feed_ids: smart_table::new()
            }
        )
    }

    public entry fun set_asset_feed_id(
        account: &signer, asset: address, feed_id: vector<u8>
    ) acquires PriceOracleData {
        assert!(!feed_id.is_empty(), error::not_found(E_EMPTY_FEED_ID));
        update_asset_feed_id(asset, feed_id);
    }

    fun update_asset_feed_id(asset: address, feed_id: vector<u8>) acquires PriceOracleData {
        let asset_price_list = borrow_global_mut<PriceOracleData>(package_manager::get_resource_address());
        asset_price_list.asset_feed_ids.upsert(asset, feed_id);
    }

    /// @dev Checks if a feed ID exists for an asset
    /// @param asset Address of the asset
    /// @return True if a feed ID exists
    fun check_price_feed_exists(asset: address): bool acquires PriceOracleData {
        let asset_price_list = borrow_global<PriceOracleData>(package_manager::get_resource_address());
        if (asset_price_list.asset_feed_ids.contains(asset)) {
            return true;
        };
        false
    }

    /// @dev Gets the feed ID for an asset
    /// @param asset Address of the asset
    /// @return The feed ID
    fun get_feed_id(asset: address): vector<u8> acquires PriceOracleData {
        let asset_price_list = borrow_global<PriceOracleData>(package_manager::get_resource_address());
        *asset_price_list.asset_feed_ids.borrow(asset)
    }

    fun validate_oracle_price(price: u256) {
        assert!(
            price <= I192_MAX,
            error::invalid_argument(E_NEGATIVE_PRICE)
        );
        assert!(
            price > 0,
            error::invalid_argument(E_ZERO_PRICE)
        );
    }

    fun validate_oracle_timestamp(
        asset: address, price_timestamp_secs: u256
    ) {
        let current_time_secs = timestamp::now_seconds() as u256;
        // ensure oracle timestamp is not from the future
        assert!(
            price_timestamp_secs <= current_time_secs,
            error::invalid_argument(E_TIMESTAMP_IN_FUTURE)
        );
    }

    fun get_asset_price_internal(asset: address): (u256, u256) acquires PriceOracleData {
        if (check_price_feed_exists(asset)) {
            let feed_id = get_feed_id(asset);
            let benchmarks =
                chainlink_router::get_benchmarks(
                    &package_manager::get_signer(),
                    vector[feed_id],
                    vector[]
                );
            assert_benchmarks_match_assets(benchmarks.length(), 1);
            let benchmark = benchmarks.borrow(0);
            let price = chainlink::get_benchmark_value(benchmark);
            validate_oracle_price(price);
            let timestamp = chainlink::get_benchmark_timestamp(benchmark);
            validate_oracle_timestamp(asset, timestamp);
            return (price, timestamp);
        };

        assert!(false, error::invalid_argument(E_ASSET_NOT_REGISTERED));
        (0, 0)
    }

    #[view]
    /// @notice Gets the current price of an asset, respecting any price cap
    /// @param asset Address of the asset
    /// @return The asset price (capped if applicable)
    public fun get_asset_price(asset: address): u256 acquires PriceOracleData {
        let (price, _) = get_asset_price_and_timestamp(asset);
        price
    }

    #[view]
    /// @notice Gets the current price of an asset and its timestamp, respecting any price cap
    /// @param asset Address of the asset
    /// @return The asset price and its timestamp as a tuple (capped if applicable)
    public fun get_asset_price_and_timestamp(asset: address): (u256, u256) acquires PriceOracleData {
        let (underlying_asset_price, underlying_asset_timestamp) = get_asset_price_internal(
            asset
        );
        (underlying_asset_price, underlying_asset_timestamp)
    }

    /// @dev Verifies that the number of benchmarks matches the number of requested assets
    /// @param benchmarks_len Number of benchmarks
    /// @param requested_assets Number of requested assets
    fun assert_benchmarks_match_assets(
        benchmarks_len: u64, requested_assets: u64
    ) {
        assert!(
            benchmarks_len == requested_assets,
            error::aborted(E_BENCHMARK_MISMATCH)
        );
    }

}
