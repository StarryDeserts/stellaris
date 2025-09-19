module stellaris::market {

    use std::bcs;
    use std::error;
    use std::signer;
    use std::vector;
    use aptos_std::math128;
    use aptos_framework::event;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::object::{Self, Object};
    use stellaris::fixed_point64::{Self, FixedPoint64};
    use aptos_framework::fungible_asset::{Self, FungibleStore, FungibleAsset};
    use stellaris::yield_factory;
    use stellaris::oracle;

    use stellaris::sy;
    use stellaris::py;
    use stellaris::utils;
    use stellaris::market_math;
    use stellaris::py::PyState;
    use stellaris::market_global;
    use stellaris::math_fixed64_with_sign;
    use stellaris::fixed_point64_with_sign;
    use stellaris::py_position::{Self, PyPosition};
    use stellaris::market_position::{Self, MarketPosition};
    use stellaris::fixed_point64_with_sign::FixedPoint64WithSign;
    use stellaris::package_manager::{Self, get_signer, get_resource_address};

    const ORACLE_PRECISION_FACTOR: u128 = 1000000000000000000u128;

    /// 代表一个完整的、独立的 PT/SY 交易池。协议中每个不同到期日的市场都会有一个自己专属的 MarketPool 对象
    struct MarketPool has key {
        py_state_address: address,
        expiry: u64,
        total_pt: u64,
        total_sy: Object<FungibleStore>,
        lp_supply: u64,
        last_ln_implied_rate: FixedPoint64,
        current_exchange_rate: FixedPoint64WithSign,
        vault: Object<FungibleStore>,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
        market_cap: u64, //  市场的最大容量限制（以SY计价），一个可选的安全参数
        // reward_pool: RewardPool
    }

    /// 这是一个临时的、仅在函数调用期间存在的“快照”结构体
    /// 它通过一次性计算，将 MarketPool 中多个原始参数转换并缓存为 market_math 模块中直接需要的衍生参数
    struct MarketPoolCache has copy, drop {
        total_asset: FixedPoint64,
        rate_scalar: FixedPoint64WithSign,
        rate_anchor: FixedPoint64WithSign,
        fee_rate: FixedPoint64WithSign,
        time_to_expire: u64,
        index: FixedPoint64,
        exchange_rate: FixedPoint64,
    }

    #[event]
    struct AddLiquidityEvent has store, drop {
        market_state_address: address,
        expiry: u64,
        pt_amount: u64,
        sy_amount: u64,
        lp_amount: u64,
        exchange_rate: FixedPoint64WithSign,
    }

    #[event]
    struct SwapEvent has store, drop {
        market_state_address: address,
        expiry: u64,
        pt_amount: FixedPoint64WithSign,
        sy_amount: FixedPoint64WithSign,
        fee: FixedPoint64WithSign,
        reserve_fee: FixedPoint64WithSign,
        exchange_rate: FixedPoint64WithSign,
    }

    public(package) fun create_pool(
        py_state: Object<PyState>,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
        market_cap: u64,
    ) : address {
        let (pool_signer, market_pool_address) = calc_market_pool_signer_and_address(
            object::object_address(&py_state),
            scalar_root,
            initial_anchor,
            ln_fee_rate_root
        );
        let market_pool = MarketPool {
            py_state_address: object::object_address(&py_state),
            expiry: py::expiry(py_state),
            total_pt: 0,
            total_sy: fungible_asset::create_store(&object::create_object(signer::address_of(&pool_signer)), py::sy_metadata_address(py_state)),
            lp_supply: 0,
            last_ln_implied_rate: fixed_point64::zero(),
            current_exchange_rate: fixed_point64_with_sign::zero(),
            vault: fungible_asset::create_store(&object::create_object(signer::address_of(&pool_signer)), py::sy_metadata_address(py_state)),
            scalar_root,
            initial_anchor,
            ln_fee_rate_root,
            market_cap,
        };
        move_to<MarketPool>(&pool_signer, market_pool);
        market_pool_address
    }


    // TODO：测试网版本，可见性应该设置为私有的
    public fun get_market_pool_cache_internal(
        current_price_from_oracle: FixedPoint64,
        market_pool: &MarketPool,
        py_state: Object<PyState>,
    ) :MarketPoolCache {
        let (
            total_asset_val,
            rate_scalar_val,
            rate_anchor_val,
            fee_rate_val,
            time_to_expire_val,
            current_py_index_val
        ) = get_market_state(current_price_from_oracle, py_state, market_pool);
        // 2. 将返回的元组值组装成 MarketPoolCache 结构体
        MarketPoolCache {
            total_asset: total_asset_val,
            rate_scalar: rate_scalar_val,
            rate_anchor: rate_anchor_val,
            fee_rate: fee_rate_val,
            time_to_expire: time_to_expire_val,
            index: current_py_index_val,
            exchange_rate: current_price_from_oracle, // 直接使用传入的预言机价格
        }
    }

    // TODO：测试网版本，可见性应该设置为 package
    public fun get_market_pool_cache(
        current_price_from_oracle: FixedPoint64,
        market_pool_object: Object<MarketPool>,
        py_state: Object<PyState>,
    ) :MarketPoolCache acquires MarketPool {
        let market_pool= borrow_global<MarketPool>(object::object_address(&market_pool_object));
        let (
            total_asset_val,
            rate_scalar_val,
            rate_anchor_val,
            fee_rate_val,
            time_to_expire_val,
            current_py_index_val
        ) = get_market_state(current_price_from_oracle, py_state, market_pool);
        // 2. 将返回的元组值组装成 MarketPoolCache 结构体
        MarketPoolCache {
            total_asset: total_asset_val,
            rate_scalar: rate_scalar_val,
            rate_anchor: rate_anchor_val,
            fee_rate: fee_rate_val,
            time_to_expire: time_to_expire_val,
            index: current_py_index_val,
            exchange_rate: current_price_from_oracle, // 直接使用传入的预言机价格
        }
    }

    ///
    public entry fun mint_lp(
        user: &signer,
        sy_amount: u64,
        pt_amount_to_add: u64,
        min_lp_out: u64,
        user_py_position: Object<PyPosition>,
        py_state: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) acquires MarketPool {
        let (user_pt_balance, _) = py_position::py_amount(user_py_position);
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        assert!(utils::now_milliseconds() < py_position::expiry(user_py_position), error::invalid_argument(10));
        // 确保想要获得的 PT 大于 0
        assert!(pt_amount_to_add > 0, error::aborted(11));
        // 确保用户在 py_position 中的余额足够
        assert!(user_pt_balance >= pt_amount_to_add, error::aborted(12));
        // 确保用户的 SY 余额足够
        let sy_metatda = py::sy_metadata_address(py_state);
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        // 确保 py_position 与 py_state 是同一个
        assert!(py_position::py_state_id(user_py_position) == object::object_address(&py_state), error::permission_denied(13));
        // 确保传入的market 与 py_state 相符
        assert!(market_pool.py_state_address == object::object_address(&py_state), error::permission_denied(14));
        // 取出用户的 sy 资产
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);

        // 2. 为用户创建一个新的 market position 对象
        let constructor_ref = &object::create_object(signer::address_of(user));
        let new_market_position = market_position::open_position(
            constructor_ref,
            signer::address_of(user),
            object::object_address(&market_pool_object),
            fungible_asset::name(sy_metatda),
            market_pool.expiry
        );
        // 3. 从预言机获取当前汇率
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128), ORACLE_PRECISION_FACTOR
        );
        let remaining_sy_coin = mint_lp_internal(
            pt_amount_to_add,
            user_sy_balance,
            current_price,
            user_py_position,
            py_state,
            new_market_position,
            market_pool,
            object::object_address(&market_pool_object)
        );
        check_market_cap_internal(market_pool);
        assert!(market_position::lp_amount(new_market_position) >= min_lp_out, error::aborted(16)); // 检查产出的LP是否满足最小期望
        // 6. 返回多余的SY代币和新创建的LP头寸对象
        primary_fungible_store::deposit(signer::address_of(user), remaining_sy_coin);
    }

    public(package) fun mint_lp_internal(
        pt_amount_in: u64,
        user_sy_balance: FungibleAsset,
        current_index_from_oracle: FixedPoint64,
        user_py_position: Object<PyPosition>,
        py_state: Object<PyState>,
        user_market_position: Object<MarketPosition>,
        market_pool: &mut MarketPool,
        market_pool_address: address
    ) :FungibleAsset {
        let sy_token_amount = fungible_asset::amount(&user_sy_balance);
        // 逻辑分支：如果池子为空
        if (market_pool.lp_supply == 0) {
            // --- 分支 A: 初始化流动性池 (首次添加流动性) ---
            // 1. 计算初始 LP 数量。公式为 PT 和 SY 数量的几何平均数。
            let initial_lp_total = (math128::sqrt((pt_amount_in as u128) * (sy_token_amount as u128)) as u64);
            // 确保初始流动性不低于一个阈值
            assert!(initial_lp_total >= 1000, error::aborted(2));
            // 2. 为了防止精度损失和三明治攻击，协议会永久锁定一小部分LP（1000个单位）
            let user_lp_to_receive = initial_lp_total - 1000;
            // 3. 更新状态
            // 从用户的 PY 头寸中扣除 PT
            py::split_pt(pt_amount_in, user_py_position);
            market_pool.total_pt += pt_amount_in;
            fungible_asset::deposit(market_pool.total_sy, fungible_asset::extract(&mut user_sy_balance, sy_token_amount));
            market_pool.lp_supply = initial_lp_total;
            // 4. 更新用户的LP头寸
            market_position::set_lp_amount(user_market_position, user_lp_to_receive);
            market_position::update_lp_display(user_market_position);
            // 5. 初始化市场的隐含利率
            let exchange_rate = get_exchange_rate(py_state, market_pool, current_index_from_oracle, true);
            market_pool.last_ln_implied_rate = get_ln_implied_rate(exchange_rate, market_pool.expiry - utils::now_milliseconds());
            assert!(!fixed_point64::eq(&market_pool.last_ln_implied_rate, &fixed_point64::zero()), error::invalid_argument(3));
            // 发布添加流动性的事件
            event::emit(AddLiquidityEvent {
                market_state_address: market_pool_address,
                expiry: market_pool.expiry,
                pt_amount: pt_amount_in,
                sy_amount: sy_token_amount,
                lp_amount: user_lp_to_receive,
                exchange_rate,
            });
            // farming_reward::stake_rewarder()
            user_sy_balance
        } else {
            // --- 分支 B: 向现有池中添加流动性 ---
            // 1. 根据当前池中 PT 和 SY 的比例，计算出添加等值流动性应该获得的 LP 数量
            let lp_from_pt = (((pt_amount_in as u128) * (market_pool.lp_supply as u128) / (market_pool.total_pt as u128)) as u64);
            let lp_from_sy = (((sy_token_amount as u128) * (market_pool.lp_supply as u128) / (fungible_asset::balance(market_pool.total_sy) as u128)) as u64);
            assert!(lp_from_pt > 0 && lp_from_sy > 0, error::invalid_argument(4));
            // 2. 选择较小的一方作为本次获得的 LP 数量，以确保是按当前价格比例添加的。多余的另一种代币将被退还
            if (lp_from_pt < lp_from_sy) {
                // 以 PT 为准，计算需要多少 SY, 多余的 SY 将被退还
                let user_lp_to_receive = lp_from_pt;
                let sy_to_join_market = ((((fungible_asset::balance(market_pool.total_sy) as u128) * (user_lp_to_receive as u128) + ((market_pool.lp_supply - 1) as u128)) / (market_pool.lp_supply as u128)) as u64);
                assert!(sy_to_join_market > 0, error::invalid_argument(5));
                // 更新状态
                market_pool.total_pt += pt_amount_in;
                py::split_pt(pt_amount_in, user_py_position);
                let sy_to_join_balance = fungible_asset::extract(&mut user_sy_balance, sy_to_join_market);
                fungible_asset::deposit(market_pool.total_sy, sy_to_join_balance);
                market_pool.lp_supply += user_lp_to_receive;
                // 更新用户头寸
                market_position::increase_lp_amount(user_market_position, user_lp_to_receive);
                let _exchange_rate = get_exchange_rate(py_state, market_pool, current_index_from_oracle, false);
                market_position::update_lp_display(user_market_position);
                // 发布添加流动性的事件
                event::emit(AddLiquidityEvent {
                    market_state_address: market_pool_address,
                    expiry: market_pool.expiry,
                    pt_amount: pt_amount_in,
                    sy_amount: sy_token_amount,
                    lp_amount: user_lp_to_receive,
                    exchange_rate: _exchange_rate,
                });
                // farming_reward::stake_rewarder()
                user_sy_balance
            } else {
                // 以 SY 为准，计算需要多少 PT，多余的 PT 将被退还
                let _user_lp_to_receive = lp_from_sy;
                let pt_to_join_market = ((((market_pool.total_pt as u128) * (_user_lp_to_receive as u128) + ((market_pool.lp_supply - 1) as u128)) / (market_pool.lp_supply as u128)) as u64);
                assert!(pt_to_join_market > 0, error::invalid_argument(6));
                // 更新状态
                fungible_asset::deposit(market_pool.total_sy, fungible_asset::extract(&mut user_sy_balance, sy_token_amount));
                py::split_pt(pt_to_join_market, user_py_position);
                market_pool.total_pt += pt_to_join_market;
                market_pool.lp_supply += _user_lp_to_receive;
                // 发布添加流动性的事件
                event::emit(AddLiquidityEvent {
                    market_state_address: market_pool_address,
                    expiry: market_pool.expiry,
                    pt_amount: pt_amount_in,
                    sy_amount: sy_token_amount,
                    lp_amount: _user_lp_to_receive,
                    exchange_rate: get_exchange_rate(py_state, market_pool, current_index_from_oracle, false),
                });
                // farming_reward::stake_rewarder()
                user_sy_balance
            }
        }
    }

    public(package) fun mint_lp_out_internal(
        pt_amount_in: u64,
        sy_token_amount: u64,
        user_sy_balance: FungibleAsset,
        current_index_from_oracle: FixedPoint64,
        user_py_position: Object<PyPosition>,
        py_state: Object<PyState>,
        user_market_position: Object<MarketPosition>,
        market_pool_object: Object<MarketPool>
    ) :FungibleAsset acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        // 逻辑分支：如果池子为空
        if (market_pool.lp_supply == 0) {
            // --- 分支 A: 初始化流动性池 (首次添加流动性) ---
            // 1. 计算初始 LP 数量。公式为 PT 和 SY 数量的几何平均数。
            let initial_lp_total = (math128::sqrt((pt_amount_in as u128) * (sy_token_amount as u128)) as u64);
            // 确保初始流动性不低于一个阈值
            assert!(initial_lp_total >= 1000, error::aborted(2));
            // 2. 为了防止精度损失和三明治攻击，协议会永久锁定一小部分LP（1000个单位）
            let user_lp_to_receive = initial_lp_total - 1000;
            // 3. 更新状态
            // 从用户的 PY 头寸中扣除 PT
            py::split_pt(pt_amount_in, user_py_position);
            market_pool.total_pt += pt_amount_in;
            fungible_asset::deposit(market_pool.total_sy, fungible_asset::extract(&mut user_sy_balance, sy_token_amount));
            market_pool.lp_supply = initial_lp_total;
            // 4. 更新用户的LP头寸
            market_position::set_lp_amount(user_market_position, user_lp_to_receive);
            market_position::update_lp_display(user_market_position);
            // 5. 初始化市场的隐含利率
            let exchange_rate = get_exchange_rate(py_state, market_pool, current_index_from_oracle, true);
            market_pool.last_ln_implied_rate = get_ln_implied_rate(exchange_rate, market_pool.expiry - utils::now_milliseconds());
            assert!(!fixed_point64::eq(&market_pool.last_ln_implied_rate, &fixed_point64::zero()), error::invalid_argument(3));
            // 发布添加流动性的事件
            event::emit(AddLiquidityEvent {
                market_state_address: object::object_address(&market_pool_object),
                expiry: market_pool.expiry,
                pt_amount: pt_amount_in,
                sy_amount: sy_token_amount,
                lp_amount: user_lp_to_receive,
                exchange_rate,
            });
            // farming_reward::stake_rewarder()
            user_sy_balance
        } else {
            // --- 分支 B: 向现有池中添加流动性 ---
            // 1. 根据当前池中 PT 和 SY 的比例，计算出添加等值流动性应该获得的 LP 数量
            let lp_from_pt = (((pt_amount_in as u128) * (market_pool.lp_supply as u128) / (market_pool.total_pt as u128)) as u64);
            let lp_from_sy = (((sy_token_amount as u128) * (market_pool.lp_supply as u128) / (fungible_asset::balance(market_pool.total_sy) as u128)) as u64);
            assert!(lp_from_pt > 0 && lp_from_sy > 0, error::invalid_argument(4));
            // 2. 选择较小的一方作为本次获得的 LP 数量，以确保是按当前价格比例添加的。多余的另一种代币将被退还
            if (lp_from_pt < lp_from_sy) {
                // 以 PT 为准，计算需要多少 SY, 多余的 SY 将被退还
                let user_lp_to_receive = lp_from_pt;
                let sy_to_join_market = ((((fungible_asset::balance(market_pool.total_sy) as u128) * (user_lp_to_receive as u128) + ((market_pool.lp_supply - 1) as u128)) / (market_pool.lp_supply as u128)) as u64);
                assert!(sy_to_join_market > 0, error::invalid_argument(5));
                // 更新状态
                market_pool.total_pt += pt_amount_in;
                py::split_pt(pt_amount_in, user_py_position);
                let sy_to_join_balance = fungible_asset::extract(&mut user_sy_balance, sy_to_join_market);
                fungible_asset::deposit(market_pool.total_sy, sy_to_join_balance);
                market_pool.lp_supply += user_lp_to_receive;
                // 更新用户头寸
                market_position::increase_lp_amount(user_market_position, user_lp_to_receive);
                let _exchange_rate = get_exchange_rate(py_state, market_pool, current_index_from_oracle, false);
                market_position::update_lp_display(user_market_position);
                // 发布添加流动性的事件
                event::emit(AddLiquidityEvent {
                    market_state_address: object::object_address(&market_pool_object),
                    expiry: market_pool.expiry,
                    pt_amount: pt_amount_in,
                    sy_amount: sy_token_amount,
                    lp_amount: user_lp_to_receive,
                    exchange_rate: _exchange_rate,
                });
                // farming_reward::stake_rewarder()
                user_sy_balance
            } else {
                // 以 SY 为准，计算需要多少 PT，多余的 PT 将被退还
                let _user_lp_to_receive = lp_from_sy;
                let pt_to_join_market = ((((market_pool.total_pt as u128) * (_user_lp_to_receive as u128) + ((market_pool.lp_supply - 1) as u128)) / (market_pool.lp_supply as u128)) as u64);
                assert!(pt_to_join_market > 0, error::invalid_argument(6));
                // 更新状态
                fungible_asset::deposit(market_pool.total_sy, fungible_asset::extract(&mut user_sy_balance, sy_token_amount));
                py::split_pt(pt_to_join_market, user_py_position);
                market_pool.total_pt += pt_to_join_market;
                market_pool.lp_supply += _user_lp_to_receive;
                // 发布添加流动性的事件
                event::emit(AddLiquidityEvent {
                    market_state_address: object::object_address(&market_pool_object),
                    expiry: market_pool.expiry,
                    pt_amount: pt_amount_in,
                    sy_amount: sy_token_amount,
                    lp_amount: _user_lp_to_receive,
                    exchange_rate: get_exchange_rate(py_state, market_pool, current_index_from_oracle, false),
                });
                // farming_reward::stake_rewarder()
                user_sy_balance
            }
        }
    }

    public entry fun swap_sy_for_exact_pt(
        user: &signer,
        exact_pt_out: u64,
        sy_amount: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    )  acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        // 确保 py_position 与 py_state 是同一个
        assert!(py_position::py_state_id(user_py_position) == object::object_address(&py_state_object), error::permission_denied(13));
        // 确保传入的market 与 py_state 相符
        assert!(market_pool.py_state_address == object::object_address(&py_state_object), error::permission_denied(14));assert!(py_position::py_state_id(user_py_position) == market_pool.py_state_address, error::aborted(18));
        assert!(market_pool.py_state_address == object::object_address(&market_pool_object), error::aborted(19));
        assert!(exact_pt_out <= market_pool.total_pt, error::aborted(21));
        let sy_metatda = py::sy_metadata_address(py_state_object);
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        // 取出用户的 sy 资产
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);
        // 3. 从预言机获取当前汇率
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128), ORACLE_PRECISION_FACTOR
        );
        // 3. 生成市场状态缓存，为核心计算做准备
        let market_cache = get_market_pool_cache_internal(
            current_price,
            market_pool,
            py_state_object
        );
        // 4. 调用内部核心交易函数
        let received_sy_coin = swap_sy_for_exact_pt_internal(
            exact_pt_out,
            user_sy_balance,
            user_py_position,
            py_state_object,
            current_price,
            &market_cache,
            market_pool,
            object::object_address(&market_pool_object)
        );
        // 5. 返还剩下的 sy token
        primary_fungible_store::deposit(signer::address_of(user), received_sy_coin);
    }

    /// TODO: py_state_object 和 current_index_from_oracle 这个参数在方法内部没有被使用到
    public(package) fun swap_sy_for_exact_pt_internal(
        pt_amount_out: u64,
        user_sy_balance: FungibleAsset,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        current_index_from_oracle: FixedPoint64,
        market_cache: &MarketPoolCache,
        market_pool: &mut MarketPool,
        market_pool_address: address
    ) :FungibleAsset {
        // 1. 调用交易核心函数进行计算
        // 买入 PT，对于池子来说是 PT 减少，所以 pt_delta 是正数。
        let pt_delta = fixed_point64_with_sign::from_uint64(pt_amount_out);
        let (sy_in_gross, reserve_fee, trade_fee, new_rate_scalar, new_rate_anchor) = execute_trade_core_internal(
            pt_delta,
            market_cache,
            market_pool,
            market_pool_address
        );

        // 2. 从用户支付中分出非费用部分，加入市场流动性
        let sy_in_including_fee = fixed_point64_with_sign::neg(sy_in_gross);
        let sy_to_market_amount = fixed_point64_with_sign::truncate(fixed_point64_with_sign::sub(sy_in_including_fee, reserve_fee));
        let sy_to_market_balance = fungible_asset::extract(&mut user_sy_balance, sy_to_market_amount);
        fungible_asset::deposit(market_pool.total_sy, sy_to_market_balance);

        // 从用户支付中分出费用部分，加入金库
        let reserve_fee_amount = fixed_point64_with_sign::truncate(reserve_fee);
        let reserve_fee_balance = fungible_asset::extract(&mut user_sy_balance, reserve_fee_amount);
        fungible_asset::deposit(market_pool.total_sy, reserve_fee_balance);

        // 3. 更新市场和用户状态
        market_pool.total_pt -= pt_amount_out; // 市场 PT 减少
        py::join_pt(pt_amount_out, user_py_position); // PT 加入用户头寸

        // 4. 计算并更新交易后的市场汇率和隐含利率
        let total_sy_asset_after_trade = sy::sy_to_asset(market_cache.index, fixed_point64::encode(fungible_asset::balance(market_pool.total_sy)));
        let new_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_sy_asset_after_trade)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            new_rate_scalar,
            new_rate_anchor,
            fixed_point64_with_sign::zero()
        );
        market_pool.last_ln_implied_rate = get_ln_implied_rate(new_exchange_rate, market_pool.expiry - utils::now_milliseconds());

        // 5. 发出交易事件
        event::emit( SwapEvent {
            market_state_address: market_pool_address,
            expiry: market_pool.expiry,
            pt_amount: pt_delta,
            sy_amount: sy_in_including_fee,
            fee: trade_fee,
            reserve_fee,
            exchange_rate: new_exchange_rate
        });

        // 6. 将用户多付的SY（找零）返回
        user_sy_balance
    }

    /// TODO: py_state_object 和 current_index_from_oracle 这个参数在方法内部没有被使用到
    public(package) fun swap_sy_for_exact_pt_out_internal(
        pt_amount_out: u64,
        user_sy_balance: FungibleAsset,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        current_index_from_oracle: FixedPoint64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :FungibleAsset acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        // 1. 调用交易核心函数进行计算
        // 买入 PT，对于池子来说是 PT 减少，所以 pt_delta 是正数。
        let pt_delta = fixed_point64_with_sign::from_uint64(pt_amount_out);
        let (sy_in_gross, reserve_fee, trade_fee, new_rate_scalar, new_rate_anchor) = execute_trade_core_internal(
            pt_delta,
            market_cache,
            market_pool,
            object::object_address(&market_pool_object)
        );

        // 2. 从用户支付中分出非费用部分，加入市场流动性
        let sy_in_including_fee = fixed_point64_with_sign::neg(sy_in_gross);
        let sy_to_market_amount = fixed_point64_with_sign::truncate(fixed_point64_with_sign::sub(sy_in_including_fee, reserve_fee));
        let sy_to_market_balance = fungible_asset::extract(&mut user_sy_balance, sy_to_market_amount);
        fungible_asset::deposit(market_pool.total_sy, sy_to_market_balance);

        // 从用户支付中分出费用部分，加入金库
        let reserve_fee_amount = fixed_point64_with_sign::truncate(reserve_fee);
        let reserve_fee_balance = fungible_asset::extract(&mut user_sy_balance, reserve_fee_amount);
        fungible_asset::deposit(market_pool.total_sy, reserve_fee_balance);

        // 3. 更新市场和用户状态
        market_pool.total_pt -= pt_amount_out; // 市场 PT 减少
        py::join_pt(pt_amount_out, user_py_position); // PT 加入用户头寸

        // 4. 计算并更新交易后的市场汇率和隐含利率
        let total_sy_asset_after_trade = sy::sy_to_asset(market_cache.index, fixed_point64::encode(fungible_asset::balance(market_pool.total_sy)));
        let new_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_sy_asset_after_trade)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            new_rate_scalar,
            new_rate_anchor,
            fixed_point64_with_sign::zero()
        );
        market_pool.last_ln_implied_rate = get_ln_implied_rate(new_exchange_rate, market_pool.expiry - utils::now_milliseconds());

        // 5. 发出交易事件
        event::emit( SwapEvent {
            market_state_address: object::object_address(&market_pool_object),
            expiry: market_pool.expiry,
            pt_amount: pt_delta,
            sy_amount: sy_in_including_fee,
            fee: trade_fee,
            reserve_fee,
            exchange_rate: new_exchange_rate
        });

        // 6. 将用户多付的SY（找零）返回
        user_sy_balance
    }

    public entry fun swap_exact_pt_for_sy(
        user: &signer,
        pt_amount_in: u64,
        min_sy_out: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        let (user_pt_balance, _) = py_position::py_amount(user_py_position);
        assert!(user_pt_balance >= pt_amount_in, error::aborted(17));
        // 确保 py_position 与 py_state 是同一个
        assert!(py_position::py_state_id(user_py_position) == object::object_address(&py_state_object), error::permission_denied(13));
        // 确保传入的market 与 py_state 相符
        assert!(market_pool.py_state_address == object::object_address(&py_state_object), error::permission_denied(14));
        assert!(utils::now_milliseconds() < market_pool.expiry, error::aborted(20));
        let sy_metatda = py::sy_metadata_address(py_state_object);
        // 3. 从预言机获取当前汇率
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128), ORACLE_PRECISION_FACTOR
        );
        // 3. 生成市场状态缓存，为核心计算做准备
        let market_cache = get_market_pool_cache_internal(
            current_price,
            market_pool,
            py_state_object
        );
        // 4. 调用内部核心交易函数
        let received_sy_coin = swap_exact_pt_for_sy_internal(
            pt_amount_in,
            user_py_position,
            py_state_object,
            current_price,
            &market_cache,
            market_pool,
            object::object_address(&market_pool_object)
        );
        // 5. 滑点检查：确保用户收到的 SY 不低于其设定的最小值
        assert!(fungible_asset::amount(&received_sy_coin) >= min_sy_out, error::aborted(21));

        // 6. 返回用户应得的 SY 代币
        primary_fungible_store::deposit(signer::address_of(user), received_sy_coin);
    }

    /// TODO: py_state_object 和 current_index_from_oracle 这个参数在方法内部没有被使用到
    public(package) fun swap_exact_pt_for_sy_internal(
        pt_amount_in: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        current_index_from_oracle: FixedPoint64,
        market_cache: &MarketPoolCache,
        market_pool: &mut MarketPool,
        market_pool_address: address
    ) :FungibleAsset {
        // 1. 调用交易核心函数进行计算
        // 卖出 PT，对于池子来说是 PT 增加，所以 pt_delta 是正数。
        // 但在交易模型中，通常把 "用户卖出" 表示为负数 delta
        let pt_delta = fixed_point64_with_sign::neg(fixed_point64_with_sign::from_uint64(pt_amount_in));
        let (sy_out_gross, reserve_fee, trade_fee, new_rate_scalar, new_rate_anchor) = execute_trade_core_internal(
            pt_delta,
            market_cache,
            market_pool,
            market_pool_address
        );

        // 2. 检查池子是否有足够的 SY 来完成此交易
        assert!(
            fixed_point64_with_sign::less_or_equal(sy_out_gross, reserve_fee) ||
                fixed_point64_with_sign::truncate(fixed_point64_with_sign::sub(sy_out_gross, reserve_fee)) <= fungible_asset::balance(market_pool.total_sy),
            error::aborted(9)
        );

        // 3. 更新市场和用户状态
        market_pool.total_pt += pt_amount_in; // 市场 PT 增加
        py::split_pt(pt_amount_in, user_py_position); // 从用户头寸中扣除 PT

        // 4. 处理费用和支付
        // 将金库费用（reserve_fee）转入 vault
        let reserve_fee_amount = fixed_point64_with_sign::truncate(reserve_fee);
        // balance::join(&mut market_state.vault, coin::into_balance(coin::take(&mut market_state.total_sy, reserve_fee_amount, ctx)));
        fungible_asset::deposit(market_pool.vault, fungible_asset::withdraw(&get_signer(), market_pool.total_sy, reserve_fee_amount));

        // 5. 计算并更新交易后的市场汇率和隐含利率
        let total_sy_asset_after_trade = sy::sy_to_asset(market_cache.index, fixed_point64::encode(fungible_asset::balance(market_pool.total_sy)));
        let new_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_sy_asset_after_trade)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            new_rate_scalar,
            new_rate_anchor,
            fixed_point64_with_sign::zero()
        );
        market_pool.last_ln_implied_rate = get_ln_implied_rate(new_exchange_rate, market_pool.expiry - utils::now_milliseconds());

        // 6. 发出交易事件
        event::emit( SwapEvent {
            market_state_address: market_pool_address,
            expiry: market_pool.expiry,
            pt_amount: pt_delta,
            sy_amount:  fixed_point64_with_sign::neg(sy_out_gross),
            fee: trade_fee,
            reserve_fee,
            exchange_rate: new_exchange_rate
        });

        // 7. 将用户应得的 SY 从市场池中取出并返回
        let sy_to_user_amount = fixed_point64_with_sign::truncate(sy_out_gross);
        fungible_asset::withdraw(&get_signer(), market_pool.total_sy, sy_to_user_amount)
    }

    /// TODO: py_state_object 和 current_index_from_oracle 这个参数在方法内部没有被使用到
    public(package) fun swap_exact_pt_for_sy_out_internal(
        pt_amount_in: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        current_index_from_oracle: FixedPoint64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :FungibleAsset acquires MarketPool {
        // 1. 调用交易核心函数进行计算
        // 卖出 PT，对于池子来说是 PT 增加，所以 pt_delta 是正数。
        // 但在交易模型中，通常把 "用户卖出" 表示为负数 delta
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        let pt_delta = fixed_point64_with_sign::neg(fixed_point64_with_sign::from_uint64(pt_amount_in));
        let (sy_out_gross, reserve_fee, trade_fee, new_rate_scalar, new_rate_anchor) = execute_trade_core_internal(
            pt_delta,
            market_cache,
            market_pool,
            object::object_address(&market_pool_object)
        );

        // 2. 检查池子是否有足够的 SY 来完成此交易
        assert!(
            fixed_point64_with_sign::less_or_equal(sy_out_gross, reserve_fee) ||
                fixed_point64_with_sign::truncate(fixed_point64_with_sign::sub(sy_out_gross, reserve_fee)) <= fungible_asset::balance(market_pool.total_sy),
            error::aborted(9)
        );

        // 3. 更新市场和用户状态
        market_pool.total_pt += pt_amount_in; // 市场 PT 增加
        py::split_pt(pt_amount_in, user_py_position); // 从用户头寸中扣除 PT

        // 4. 处理费用和支付
        // 将金库费用（reserve_fee）转入 vault
        let reserve_fee_amount = fixed_point64_with_sign::truncate(reserve_fee);
        // balance::join(&mut market_state.vault, coin::into_balance(coin::take(&mut market_state.total_sy, reserve_fee_amount, ctx)));
        fungible_asset::deposit(market_pool.vault, fungible_asset::withdraw(&get_signer(), market_pool.total_sy, reserve_fee_amount));

        // 5. 计算并更新交易后的市场汇率和隐含利率
        let total_sy_asset_after_trade = sy::sy_to_asset(market_cache.index, fixed_point64::encode(fungible_asset::balance(market_pool.total_sy)));
        let new_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_sy_asset_after_trade)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            new_rate_scalar,
            new_rate_anchor,
            fixed_point64_with_sign::zero()
        );
        market_pool.last_ln_implied_rate = get_ln_implied_rate(new_exchange_rate, market_pool.expiry - utils::now_milliseconds());

        // 6. 发出交易事件
        event::emit( SwapEvent {
            market_state_address: object::object_address(&market_pool_object),
            expiry: market_pool.expiry,
            pt_amount: pt_delta,
            sy_amount:  fixed_point64_with_sign::neg(sy_out_gross),
            fee: trade_fee,
            reserve_fee,
            exchange_rate: new_exchange_rate
        });

        // 7. 将用户应得的 SY 从市场池中取出并返回
        let sy_to_user_amount = fixed_point64_with_sign::truncate(sy_out_gross);
        fungible_asset::withdraw(&get_signer(), market_pool.total_sy, sy_to_user_amount)
    }

    public(package) fun execute_trade_core_internal(
        pt_delta: FixedPoint64WithSign,
        market_cache: &MarketPoolCache,
        market_pool: &mut MarketPool,
        market_pool_address: address
    ) :(
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign
    ) {
        // 1. 确保池中有足够的 PT 供用户购买
        assert!(fixed_point64_with_sign::less_or_equal(pt_delta, fixed_point64_with_sign::from_uint64(market_pool.total_pt)), error::aborted(7));
        // 2. 从缓存中解包关键参数
        let rate_scalar = market_cache.rate_scalar;
        let rate_anchor = market_cache.rate_anchor;
        let fee_rate = market_cache.fee_rate;
        let py_index = market_cache.index;
        // 3. 计算本次交易的有效汇率（包含价格滑点）
        let effective_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(market_cache.total_asset)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            rate_scalar,
            rate_anchor,
            pt_delta
        );
        // 4. 计算无费用的理想 SY 交换量
        // ideal_sy = -pt_delta / effective_exchange_rate
        // 符号被反转，因为 pt_delta 和 sy_delta 的方向相反
        let ideal_sy_amount = fixed_point64_with_sign::neg(math_fixed64_with_sign::div(pt_delta, effective_exchange_rate));
        // 5. 根据交易方向，计算扣除费用后的净 SY 交换量
        let net_sy_amount = if (fixed_point64_with_sign::is_positive(pt_delta)) {
            // ---- 用户买入 PT / 支付 SY ----
            // 费用从用户支付的 SY 中收取。
            // net_sy = ideal_sy * (1 - fee_rate)
            assert!(fixed_point64_with_sign::greater_or_equal(math_fixed64_with_sign::div(effective_exchange_rate, fee_rate), fixed_point64_with_sign::one()), error::invalid_argument(8));
            math_fixed64_with_sign::mul(ideal_sy_amount, fixed_point64_with_sign::sub(fixed_point64_with_sign::one(), fee_rate))
        } else {
            // ---- 用户卖出 PT / 收到 SY ----
            // 费用从用户收到的 SY 中扣除
            math_fixed64_with_sign::div(ideal_sy_amount, fixed_point64_with_sign::add(fixed_point64_with_sign::one(), fee_rate))
        };
        // 6. 计算总费用
        // total_fee = ideal_sy - net_sy
        let total_fee = fixed_point64_with_sign::sub(ideal_sy_amount, net_sy_amount);
        // 7. 将费用从“价值”单位转换回“代币”单位
        // 由于 SY 价值随时间变化 (py_index)，费用需要除以指数来得到实际的代币数量
        let gross_sy_in_tokens = if (fixed_point64_with_sign::less(total_fee, fixed_point64_with_sign::zero())) {
            // 处理可能的负费用（精度问题），确保结果正确
            fixed_point64_with_sign::neg(
                math_fixed64_with_sign::div(
                    fixed_point64_with_sign::sub(fixed_point64_with_sign::add
                        (fixed_point64_with_sign::abs(total_fee),
                            fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)),
                        fixed_point64_with_sign::one()),
                    fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)
                )
            )
        } else {
            math_fixed64_with_sign::div(total_fee, fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true))
        };
        // 8. 拆分费用：一部分给金库 (reserve_fee)，剩余部分给流动性提供者 (trade_fee)
        let reserve_fee_percent = market_global::get_reserve_fee_percent(market_pool_address);
        let reserve_fee_in_tokens = math_fixed64_with_sign::div(
            math_fixed64_with_sign::mul(net_sy_amount,
                fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(reserve_fee_percent), true)),
            fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)
        );
        let trade_fee_in_tokens = math_fixed64_with_sign::div(net_sy_amount, fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true));
        // 9. 返回所有计算结果
        (gross_sy_in_tokens, reserve_fee_in_tokens, trade_fee_in_tokens, rate_scalar, rate_anchor)
    }

    public(package) fun execute_trade_core(
        pt_delta: FixedPoint64WithSign,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :(
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign,
        FixedPoint64WithSign
    ) acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        // 1. 确保池中有足够的 PT 供用户购买
        assert!(fixed_point64_with_sign::less_or_equal(pt_delta, fixed_point64_with_sign::from_uint64(market_pool.total_pt)), error::aborted(7));
        // 2. 从缓存中解包关键参数
        let rate_scalar = market_cache.rate_scalar;
        let rate_anchor = market_cache.rate_anchor;
        let fee_rate = market_cache.fee_rate;
        let py_index = market_cache.index;
        // 3. 计算本次交易的有效汇率（包含价格滑点）
        let effective_exchange_rate = market_math::get_exchange_rate(
            fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(market_cache.total_asset)),
            fixed_point64_with_sign::from_uint64(market_pool.total_pt),
            rate_scalar,
            rate_anchor,
            pt_delta
        );
        // 4. 计算无费用的理想 SY 交换量
        // ideal_sy = -pt_delta / effective_exchange_rate
        // 符号被反转，因为 pt_delta 和 sy_delta 的方向相反
        let ideal_sy_amount = fixed_point64_with_sign::neg(math_fixed64_with_sign::div(pt_delta, effective_exchange_rate));
        // 5. 根据交易方向，计算扣除费用后的净 SY 交换量
        let net_sy_amount = if (fixed_point64_with_sign::is_positive(pt_delta)) {
            // ---- 用户买入 PT / 支付 SY ----
            // 费用从用户支付的 SY 中收取。
            // net_sy = ideal_sy * (1 - fee_rate)
            assert!(fixed_point64_with_sign::greater_or_equal(math_fixed64_with_sign::div(effective_exchange_rate, fee_rate), fixed_point64_with_sign::one()), error::invalid_argument(8));
            math_fixed64_with_sign::mul(ideal_sy_amount, fixed_point64_with_sign::sub(fixed_point64_with_sign::one(), fee_rate))
        } else {
            // ---- 用户卖出 PT / 收到 SY ----
            // 费用从用户收到的 SY 中扣除
            math_fixed64_with_sign::div(ideal_sy_amount, fixed_point64_with_sign::add(fixed_point64_with_sign::one(), fee_rate))
        };
        // 6. 计算总费用
        // total_fee = ideal_sy - net_sy
        let total_fee = fixed_point64_with_sign::sub(ideal_sy_amount, net_sy_amount);
        // 7. 将费用从“价值”单位转换回“代币”单位
        // 由于 SY 价值随时间变化 (py_index)，费用需要除以指数来得到实际的代币数量
        let gross_sy_in_tokens = if (fixed_point64_with_sign::less(total_fee, fixed_point64_with_sign::zero())) {
            // 处理可能的负费用（精度问题），确保结果正确
            fixed_point64_with_sign::neg(
                math_fixed64_with_sign::div(
                    fixed_point64_with_sign::sub(fixed_point64_with_sign::add
                        (fixed_point64_with_sign::abs(total_fee),
                            fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)),
                        fixed_point64_with_sign::one()),
                    fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)
                )
            )
        } else {
            math_fixed64_with_sign::div(total_fee, fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true))
        };
        // 8. 拆分费用：一部分给金库 (reserve_fee)，剩余部分给流动性提供者 (trade_fee)
        let reserve_fee_percent = market_global::get_reserve_fee_percent(object::object_address(&market_pool_object));
        let reserve_fee_in_tokens = math_fixed64_with_sign::div(
            math_fixed64_with_sign::mul(net_sy_amount,
                fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(reserve_fee_percent), true)),
            fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true)
        );
        let trade_fee_in_tokens = math_fixed64_with_sign::div(net_sy_amount, fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(py_index), true));
        // 9. 返回所有计算结果
        (gross_sy_in_tokens, reserve_fee_in_tokens, trade_fee_in_tokens, rate_scalar, rate_anchor)
    }

    public(package) fun check_market_cap_internal(market_pool: &MarketPool)  {
        assert!(market_pool.market_cap == 0 || fungible_asset::balance(market_pool.total_sy) <= market_pool.market_cap, error::aborted(15));
    }
    public(package) fun check_market_cap(market_pool_object: Object<MarketPool>) acquires MarketPool {
        let market_pool = borrow_global<MarketPool>(object::object_address(&market_pool_object));
        assert!(market_pool.market_cap == 0 || fungible_asset::balance(market_pool.total_sy) <= market_pool.market_cap, error::aborted(15));
    }

    fun get_ln_implied_rate(
        exchange_rate: FixedPoint64WithSign,
        time_to_expire: u64,
    ) :FixedPoint64 {
        // Price = e^(-yield * time)  =>  yield = -ln(Price) / time
        // 1．计算汇率的自然对数：n(exchange_rate)
        let ln_exchange_rate = math_fixed64_with_sign::ln(exchange_rate);
        // 2. 取绝对值。因为 PT 价格 < 1，其对数值为负。我们需要的是正的利率。
        let abs_ln_exchange_rate = fixed_point64_with_sign::remove_sign(ln_exchange_rate);
        // 3. 将利率年化。
        // 年化利率 = (abs_ln_exchange_rate / 剩余时间) * 一年的时间
        // (abs_ln_exchange_rate * 31536000000) / time_to_expire_ms
        // 其中 31536000000是一年的毫秒数 (365 * 24 * 60 * 60 * 1000)
        fixed_point64::mul_div_fp(
            abs_ln_exchange_rate,
            fixed_point64::encode(31536000000),
            fixed_point64::encode(time_to_expire)
        )
    }

    public entry fun seed_liquidity(
        user: &signer,
        sy_amount: u64,
        user_py_position: Object<PyPosition>,
        py_state: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        assert!(utils::now_milliseconds() < market_pool.expiry, error::aborted(20));
        // 确保用户的 SY 余额足够
        let sy_metatda = py::sy_metadata_address(py_state);
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        // 确保 py_position 与 py_state 是同一个
        assert!(py_position::py_state_id(user_py_position) == object::object_address(&py_state), error::permission_denied(13));
        // 确保传入的market 与 py_state 相符
        assert!(market_pool.py_state_address == object::object_address(&py_state), error::permission_denied(14));
        // 取出用户的 sy 资产
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);
        // 2. 从预言机获取当前汇率
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128), ORACLE_PRECISION_FACTOR
        );
        // 3. 调用 yield_factory 的核心铸造函数 `mint_py_internal`
        let pt_minted_amount = yield_factory::mint_py_internal(
            fungible_asset::extract(&mut user_sy_balance, (sy_amount / 2)), // <--- 使用一半的 SY
            current_price,
            user_py_position,
            py_state
        );
        // 4. 为用户创建一个新的 market position 对象
        let constructor_ref = &object::create_object(signer::address_of(user));
        let new_market_position = market_position::open_position(
            constructor_ref,
            signer::address_of(user),
            object::object_address(&market_pool_object),
            fungible_asset::name(sy_metatda),
            market_pool.expiry
        );
        let remaining_sy_coin = mint_lp_internal(
            pt_minted_amount,
            user_sy_balance,
            current_price,
            user_py_position,
            py_state,
            new_market_position,
            market_pool,
            object::object_address(&market_pool_object)
        );
        check_market_cap_internal(market_pool);

        // 断言 `mint_lp_internal` 返回的剩余 SY Coin 数量为 0。
        //    这是一个非常重要的健全性检查，确保所有资产都被精确计算并使用，没有留下任何“灰尘”。
        assert!(fungible_asset::amount(&remaining_sy_coin) == 0, error::aborted(99));
        fungible_asset::destroy_zero(remaining_sy_coin);
    }

    // public(package) fun update_current_exchange_rate(
    //     current_index_from_oracle: FixedPoint64,
    //     py_state_object: Object<PyState>,
    //     market_pool_object: Object<MarketPool>
    // ) :FixedPoint64WithSign {
    //
    // }

    fun get_exchange_rate(
        py_state: Object<PyState>,
        market_pool: &mut MarketPool,
        current_index_from_oracle: FixedPoint64,
        force_recompute: bool
    ) :FixedPoint64WithSign {
        if (force_recompute) {
            // --- 分支 A: 强制重算 (通常用于初始化) ---
            // 这种模式不依赖于市场之前的状态（如 last_ln_implied_rate），
            // 而是基于当前池内资产和初始参数，直接计算出一个理论汇率
            // 1. 计算所有关键参数
            let current_py_index = py::current_py_index(py_state, current_index_from_oracle);
            let total_asset_value = sy::sy_to_asset(current_py_index, fixed_point64::encode(fungible_asset::balance(market_pool.total_sy)));
            let time_to_expire = market_pool.expiry - utils::now_milliseconds();
            let rate_scalar = market_math::get_rate_scalar(market_pool.scalar_root, time_to_expire);

            // 2. 调用底层的数学函数进行计算
            market_math::get_exchange_rate(
                fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_asset_value)),
                fixed_point64_with_sign::from_uint64(market_pool.total_pt),
                rate_scalar,
                market_pool.initial_anchor,
                fixed_point64_with_sign::zero()
            )
        } else {
            // --- 分支 B: 使用缓存计算 (常规操作) ---
            let (
                total_asset_val,
                rate_scalar,
                rate_anchor,
                _,
                _,
                _
            ) = get_market_state(current_index_from_oracle, py_state, market_pool);
            // 2. 调用底层的数学函数进行计算
            // 注意：这里使用了动态计算出的 rate_anchor 作为利率锚点
            market_math::get_exchange_rate(
                fixed_point64_with_sign::from_uint64(fixed_point64::decode_round_down(total_asset_val)),
                fixed_point64_with_sign::from_uint64(market_pool.total_pt),
                rate_scalar,
                rate_anchor,
                fixed_point64_with_sign::zero()
            )
        }
    }



    fun get_market_state(
        current_index_from_oracle: FixedPoint64,
        py_state: Object<PyState>,
        market_pool: &MarketPool,
    ) :(FixedPoint64, FixedPoint64WithSign, FixedPoint64WithSign, FixedPoint64WithSign, u64, FixedPoint64) {
        //1. 获取最新的 PY index
        let current_py_index = py::current_py_index(py_state, current_index_from_oracle);
        // 2. 计算市场总资产价值 (Total Asset Value)
        // 这是池中所有 SY 经过利息调整后的总价值
        let total_asset_value = sy::sy_to_asset(
            current_py_index,
            fixed_point64::encode(fungible_asset::balance(market_pool.total_sy))
        );
        // 3. 计算距离到期的时间
        let time_to_expire = market_pool.expiry - utils::now_milliseconds();
        // 4. 计算利率曲线的标量 (Rate Scalar)
        // 标量是利率模型的一个参数，它会随着到期时间的临近而变化
        let rate_scalar = market_math::get_rate_scalar(market_pool.scalar_root, time_to_expire);
        // 5. 计算利率曲线的锚点 (Rate Anchor)
        // 锚点是利率模型的另一个关键参数，它反映了当前市场的供需状况
        let rate_anchor = market_math::get_rate_anchor(
            fixed_point64::encode(market_pool.total_pt),
            market_pool.last_ln_implied_rate,
            total_asset_value,
            rate_scalar,
            time_to_expire
        );
        // 6. 计算交易费率 (Fee Rate)
        // 注意：这里的函数名 get_exchange_rate_from_implied_rate 容易引起误解，
        // 它实际上是根据隐含利率计算动态费率，而不是计算兑换率。
        let fee_rate = market_math::get_exchange_rate_from_implied_rate(
            market_pool.ln_fee_rate_root,
            time_to_expire
        );
        // 7. 返回所有计算出的值
        (total_asset_value, rate_scalar, rate_anchor, fee_rate, time_to_expire, current_py_index)
    }


    public(package) fun calc_market_pool_signer_and_address(
        py_state_address: address,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
    ) : (signer, address) {
        let resource_signer = package_manager::get_signer();
        let pool_constructor_ref = object::create_named_object(&resource_signer, get_pool_seeds(py_state_address, scalar_root, initial_anchor, ln_fee_rate_root));
        (object::generate_signer(&pool_constructor_ref), object::address_from_constructor_ref(&pool_constructor_ref))
    }

    public fun calc_market_address(
        py_state_address: address,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64
    ) :address {
        object::create_object_address(&get_resource_address(), get_pool_seeds(py_state_address, scalar_root, initial_anchor, ln_fee_rate_root))
    }

    public fun get_pool_seeds(
        py_state_address: address,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
    ) :vector<u8> {
        let seeds_vector = vector::empty<u8>();
        seeds_vector.append(bcs::to_bytes<address>(&py_state_address));
        seeds_vector.append(bcs::to_bytes<u128>(&fixed_point64_with_sign::get_raw_value(scalar_root)));
        seeds_vector.append(bcs::to_bytes<u128>(&fixed_point64_with_sign::get_raw_value(initial_anchor)));
        seeds_vector.append(bcs::to_bytes<u128>(&fixed_point64_with_sign::get_raw_value(fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(ln_fee_rate_root), true))));
        seeds_vector
    }

    #[view]
    public fun get_market_total_pt(market_pool_object: Object<MarketPool>) : u64 acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        market_pool.total_pt
    }

    #[view]
    public fun get_market_total_sy(market_pool_object: Object<MarketPool>) : u64 acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        fungible_asset::balance(market_pool.total_sy)
    }

    public(package) fun join_sy(market_pool_object: Object<MarketPool>, sy_balance: FungibleAsset) acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        fungible_asset::deposit(market_pool.total_sy, sy_balance);
    }

    #[view]
    public fun market_expiry(market_pool_object: Object<MarketPool>) : u64 acquires MarketPool {
        let market_pool = borrow_global_mut<MarketPool>(object::object_address(&market_pool_object));
        market_pool.expiry
    }

    public(package) fun set_market_last_ln_implied_rate(market_pool: &mut MarketPool, arg1: FixedPoint64) {
        market_pool.last_ln_implied_rate = arg1;
    }

    public(package) fun set_market_ln_fee_rate_root(market_pool: &mut MarketPool, arg1: FixedPoint64) {
        market_pool.ln_fee_rate_root = arg1;
    }

    public(package) fun set_market_scalar_root(market_pool: &mut MarketPool, arg1: FixedPoint64WithSign) {
        market_pool.scalar_root = arg1;
    }

    public(package) fun set_market_total_pt(market_pool: &mut MarketPool, arg1: u64) {
        market_pool.total_pt = arg1;
    }

    public fun get_cached_exchange_rate(market_cache: &MarketPoolCache) : FixedPoint64 {
        market_cache.exchange_rate
    }

    public fun get_cached_fee_rate(market_cache: &MarketPoolCache) : FixedPoint64WithSign {
        market_cache.fee_rate
    }

    public fun get_cached_index(market_cache: &MarketPoolCache) : FixedPoint64 {
        market_cache.index
    }

    public fun get_cached_rate_anchor(market_cache: &MarketPoolCache) : FixedPoint64WithSign {
        market_cache.rate_anchor
    }

    public fun get_cached_rate_scalar(market_cache: &MarketPoolCache) : FixedPoint64WithSign {
        market_cache.rate_scalar
    }

    public fun get_cached_time_to_expire(market_cache: &MarketPoolCache) : u64 {
        market_cache.time_to_expire
    }

    public fun get_cached_total_asset(market_cache: &MarketPoolCache) : FixedPoint64 {
        market_cache.total_asset
    }
}
