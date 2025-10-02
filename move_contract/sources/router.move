module stellaris::router {
    use std::error;
    use std::signer;
    use aptos_std::math128;
    use aptos_std::math64;
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::fungible_asset::FungibleAsset;
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;
    use stellaris::sy;
    use stellaris::fixed_point64::{Self, FixedPoint64};
    use stellaris::py_position;
    use stellaris::yield_factory;
    use stellaris::market_position;
    use stellaris::oracle;
    use stellaris::py::{Self, PyState};
    use stellaris::py_position::PyPosition;
    use stellaris::fixed_point64_with_sign;
    use stellaris::math_fixed64_with_sign;
    use stellaris::fixed_point64_with_sign::FixedPoint64WithSign;
    use stellaris::market::{Self, MarketPoolCache, MarketPool, get_market_pool_cache};


    // --- 错误码常量声明 ---
    const E_INVALID_MATH_STATE_DENOMINATOR_ZERO: u64 = 1;
    const E_MARKET_NOT_INITIALIZED: u64 = 2;
    const E_MIN_LP_OUT_NOT_MET: u64 = 3;
    const E_ZERO_SY_FROM_REDEEM: u64 = 4;
    const E_MIN_YT_OUT_NOT_MET: u64 = 5;
    const E_APPROX_LESS_THAN_MIN: u64 = 6;
    const E_RECEIVED_LESS_THAN_APPROX: u64 = 7;
    const E_INSUFFICIENT_YT_BALANCE: u64 = 8;
    const E_MIN_SY_OUT_NOT_MET: u64 = 9;
    const E_INVALID_PT_OUT_AMOUNT: u64 = 10;
    const E_MIN_PT_OUT_NOT_MET_POST_SWAP: u64 = 11;
    const E_MARKET_LIQUIDITY_TOO_LOW: u64 = 12;
    const E_MARKET_LP_AMOUNT_IS_ZERO: u64 = 14;
    const E_MARKET_INSUFFICIENT_PT_FOR_SWAP: u64 = 15;
    const E_REPAY_SY_IN_EXCEEDS_EXPECTED_SY_IN: u64 = 16;
    /// 通用错误：用户的 SY 余额不足
    const E_INSUFFICIENT_SY_BALANCE: u64 = 13;
    
    const ORACLE_PRECISION_FACTOR: u128 = 1000000000000000000u128;
    
    #[event]
    struct SwapYTEvent has store, drop {
        market_state_address: address,
        expiry: u64,
        yt_amount: u64,
        sy_amount: u64,
        exchange_rate: FixedPoint64,
    }

    public entry fun add_liquidity_single_sy(
        user: &signer,
        sy_amount: u64,
        net_pt_amount: u64,
        min_lp_out: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    )  {
        // 2. 确保市场已经初始化（即池中已有PT），因为单边加流的逻辑依赖于现有流动性
        assert!(market::get_market_total_pt(market_pool_object) > 0, error::aborted(E_MARKET_NOT_INITIALIZED));

        let sy_metadata = py::sy_metadata_address(py_state_object);
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metadata, sy_amount);
        assert!(if_sy, error::aborted(E_INSUFFICIENT_SY_BALANCE));
        // 取出用户的 sy 资产
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metadata, sy_amount);
        // 3. 从预言机获取底层资产的当前价格
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128), ORACLE_PRECISION_FACTOR
        );

        // 4. 为用户创建一个新的流动性仓位对象
        let constructor_ref = &object::create_object(signer::address_of(user));
        let new_market_position = market_position::open_position(
            constructor_ref,
            signer::address_of(user),
            object::object_address(&market_pool_object),
            fungible_asset::name(sy_metadata),
            market::market_expiry(market_pool_object)
        );

        // 5. 根据最新的价格和状态，创建市场状态缓存，以提高后续计算效率
        // 3. 生成市场状态缓存，为核心计算做准备
        let market_cache = get_market_pool_cache(
            current_price,
            market_pool_object,
            py_state_object
        );

        // 6. 核心逻辑：通过一系列嵌套调用完成“兑换+铸造LP”的原子操作
        market::join_sy(
            market_pool_object,
            market::mint_lp_out_internal(
                net_pt_amount,
                sy_amount,
                // a. 将用户的 sy_coin 换成精确数量的 PT
                market::swap_sy_for_exact_pt_out_internal(
                    net_pt_amount,
                    user_sy_balance,
                    user_py_position,
                    py_state_object,
                    current_price,
                    &market_cache,
                    market_pool_object
                ),
                current_price,
                user_py_position,
                py_state_object,
                new_market_position,
                market_pool_object
            )
        );

        // 7. 检查操作完成后，市场的总市值是否超过了设定的上限
        market::check_market_cap(market_pool_object);
        // 8. 检查用户最终获得的 LP 数量是否满足其设定的最小预期
        assert!(market_position::lp_amount(new_market_position) >= min_lp_out, error::aborted(E_MIN_LP_OUT_NOT_MET));
    }

    public(package) fun add_approx_liquidity_single_sy(
        target_sy_amount: FixedPoint64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :(u64, FixedPoint64, FixedPoint64WithSign) {
        // 初始化二分搜索的上边界
        let low_pt_out = 1;
        // 计算并初始化二分搜索的上边界，即当前市场为换取SY能卖出的最大PT量
        let high_pt_out = calc_max_pt_out_for_sy_in(market_cache, market_pool_object);

        // 开始二分搜索
        while (low_pt_out <= high_pt_out) {
            // 计算中间值作为本次尝试卖出的PT数量
            let mid_pt_out = (high_pt_out + low_pt_out) / 2;

            // 模拟交易：卖出 mid_pt_out 的 PT，看能得到多少 SY，以及交易后的新利率等
            let (net_sy_change, net_pt_change, new_rate, _, _) = market::execute_trade_core(
                fixed_point64_with_sign::from_uint64(mid_pt_out),
                market_cache,
                market_pool_object
            );
            // net_sy_change 是负数（因为是收入），取反得到正的SY数量
            let actual_sy_in = fixed_point64_with_sign::remove_sign(fixed_point64_with_sign::neg(net_sy_change));

            // 如果模拟交易得到的SY比目标还多，说明PT卖多了，需要减少PT卖出量
            if (fixed_point64::gt(&actual_sy_in, &target_sy_amount)) {
                high_pt_out = mid_pt_out - 1; // 缩小搜索范围的上界
                continue
            };

            // --- 核心平衡检查 ---
            // 目标是让（卖出的PT / 用于配对的SY） ≈ （池中原有PT / 池中原有SY）
            // 这里的逻辑通过交叉相乘来避免除法，并检查结果是否在千分之一的误差内
            // 左侧价值: 卖出的PT * (池中更新后的总SY)
            let lhs_value = (((mid_pt_out as u128) * ((market::get_market_total_sy(market_pool_object) + fixed_point64::decode_round_down(actual_sy_in) - fixed_point64::decode_round_down(fixed_point64_with_sign::remove_sign(net_pt_change))) as u128)) as u256);
            // 右侧价值: (额外提供的SY) * (池中更新后的总PT)
            let rhs_value = ((((fixed_point64::decode_round_down(target_sy_amount) as u128) - (fixed_point64::decode_round_down(actual_sy_in) as u128)) * ((market::get_market_total_pt(market_pool_object) - mid_pt_out) as u128)) as u256);

            // 检查 lhs_value 是否在 rhs_value 的 ±0.1% 误差范围内
            if (rhs_value * 999000000 / (1000000000 as u256) <= lhs_value && lhs_value <= rhs_value * 1001000000 / (1000000000 as u256)) {
                // 如果比例在误差范围内，说明找到了最佳平衡点
                return (mid_pt_out, actual_sy_in, new_rate)
            };

            // 如果 lhs_value <= rhs_value，说明卖出的PT相对不足，需要增加PT卖出量
            if (lhs_value <= rhs_value) {
                low_pt_out = mid_pt_out + 1; // 调整搜索范围的下界
                continue
            };

            // 反之，说明卖出的PT相对过多，需要减少
            high_pt_out = mid_pt_out - 1; // 调整搜索范围的上界
        };

        // 如果循环结束都没有找到满足条件的解，返回零值
        (0, fixed_point64::zero(), fixed_point64_with_sign::zero())
    }

    public entry fun swap_exact_sy_for_pt(
        user: &signer,
        min_pt_out: u64,
        exact_pt_out: u64,
        sy_amount: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    )  {
        // 2. 获取预言机价格并创建市场状态缓存
        let sy_metadata = py::sy_metadata_address(py_state_object);
        let current_price = fixed_point64::fraction_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128), ORACLE_PRECISION_FACTOR
        );
        let market_state_cache = market::get_market_pool_cache(
            current_price,
            market_pool_object,
            py_state_object
        );
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metadata, sy_amount);
        assert!(if_sy, error::aborted(E_INSUFFICIENT_SY_BALANCE));
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metadata, sy_amount);
        // 3. 检查用户输入是否有效：想要的精确数量不能小于指定的最小数量
        assert!(exact_pt_out >= min_pt_out, error::aborted(E_INVALID_PT_OUT_AMOUNT));

        // 4. 调用内部函数执行核心兑换逻辑。该函数会从 sy_coin_in 中消耗所需数量的 SY，并将 exact_pt_out 数量的 PT 记入用户的仓位。如果 sy_coin_in 不足，交易会失败。
        let remaining_sy = market::swap_sy_for_exact_pt_out_internal(
            exact_pt_out,
            user_sy_balance,
            user_py_position,
            py_state_object,
            current_price,
            &market_state_cache,
            market_pool_object
        );

        // 5. 将兑换后剩余的 SY（如果有）存入市场流动性池
        market::join_sy(market_pool_object, remaining_sy);

        // 6. 再次进行断言检查，这可能是为了双重保险或是一个冗余的检查
        assert!(exact_pt_out >= min_pt_out, error::aborted(E_MIN_PT_OUT_NOT_MET_POST_SWAP));

        // 7. 返回用户获得的 PT 数量
        // exact_pt_out
    }


    public entry fun swap_exact_sy_for_yt(
        user: &signer,
        min_yt_out: u64,
        yt_amount_out_approx: u64,
        sy_in_for_py_mint: u64,
        sy_amount: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    )  {
        // 2. 创建市场状态缓存
        let sy_metadata = py::sy_metadata_address(py_state_object);
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metadata, sy_amount);
        assert!(if_sy, error::aborted(E_INSUFFICIENT_SY_BALANCE));
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metadata, sy_amount);

        // 3. 借入 PT：这是实现杠杆操作的关键，用户借入 PT 来放大购买力
        let (_, pt_borrowed) = py::borrow_pt_amount(user_py_position, yt_amount_out_approx, py_state_object);

        // 4. 卖出借来的 PT 换取 SY
        let sy_from_swap = market::swap_exact_pt_for_sy_out_internal(
            yt_amount_out_approx,
            user_py_position,
            py_state_object,
            market::get_cached_exchange_rate(&market_state_cache),
            &market_state_cache,
            market_pool_object
        );

        // 5. 合并用户提供的 SY 和卖 PT 换来的 SY
        fungible_asset::merge(&mut sy_from_swap, user_sy_balance);

        // 6. 记录操作前的 YT 余额
        let (_, yt_balance_before) = py_position::py_amount(user_py_position);

        // 7. 使用合并后的 SY 的一部分来铸造新的 PY (YT+PT)
        yield_factory::mint_py_internal(
            fungible_asset::extract(&mut sy_from_swap, sy_in_for_py_mint),
            market::get_cached_exchange_rate(&market_state_cache),
            user_py_position,
            py_state_object,
        );

        // 8. 记录操作后的 YT 余额
        let (_, yt_balance_after) = py_position::py_amount(user_py_position);
        let yt_received = yt_balance_after - yt_balance_before;

        // 9. 滑点和有效性检查
        assert!(yt_received >= min_yt_out, error::aborted(E_MIN_YT_OUT_NOT_MET));
        assert!(yt_amount_out_approx >= min_yt_out, error::aborted(E_APPROX_LESS_THAN_MIN));
        assert!(yt_received >= yt_amount_out_approx, error::aborted(E_RECEIVED_LESS_THAN_APPROX));

        // 10. 将剩余的 SY （如果有）存入市场
        market::join_sy(market_pool_object, sy_from_swap);

        // 11. 偿还第 3 步借入的 PT
        py::repay_pt_amount(user_py_position, py_state_object, pt_borrowed);

        // 12. 触发事件
        let swap_event = SwapYTEvent{
        market_state_address: object::object_address(&market_pool_object),
        expiry: market::market_expiry(market_pool_object),
        yt_amount: yt_amount_out_approx,
        sy_amount,
        exchange_rate: market::get_cached_exchange_rate(&market_state_cache),
        };
        event::emit<SwapYTEvent>(swap_event);

        // 13. 返回实际获得的 YT 数量
        // yt_amount_out_approx
    }


    public entry fun swap_exact_yt_for_sy(
        user: &signer,
        exact_yt_in: u64,
        min_sy_out: u64,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    )  {
        let user_address = signer::address_of(user);
        // 2. 检查用户是否有足够的 YT 余额
        let (_, user_yt_balance) = py_position::py_amount(user_py_position);
        assert!(user_yt_balance >= exact_yt_in, error::aborted(E_INSUFFICIENT_YT_BALANCE));

        // 3. 创建市场状态缓存
        let sy_metadata = py::sy_metadata_address(py_state_object);
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );

        // 4. 调用内部核心函数执行兑换
        let sy_coin_out = swap_exact_yt_for_sy_internal(
            exact_yt_in,
            &market_state_cache,
            user_py_position,
            py_state_object,
            market_pool_object
        );

        // 5. 滑点检查：确保最终收到的 SY 不少于用户指定的最小值
        assert!(fungible_asset::amount(&sy_coin_out) >= min_sy_out, error::aborted(E_MIN_SY_OUT_NOT_MET));

        // 6. 返回 SY 代币
        primary_fungible_store::deposit(user_address, sy_coin_out);
    }



    public(package) fun swap_exact_yt_for_sy_internal(
        yt_amount_in: u64,
        market_cache: &MarketPoolCache,
        user_py_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : FungibleAsset {
        // 1. 卖出 YT 的第一步是借出等量的 PT。这是协议的核心机制
        let (_, pt_borrowed) = py::borrow_pt_amount(user_py_position, yt_amount_in, py_state_object);

        // 2. 赎回用户仓位中的 YT，将其转换回 SY
        let sy_from_redeem = yield_factory::redeem_py_internal(
            yt_amount_in,
            yt_amount_in,
            market::get_cached_exchange_rate(market_cache),
            user_py_position,
            py_state_object
        );
        assert!(fungible_asset::amount(&sy_from_redeem) > 0, error::aborted(E_ZERO_SY_FROM_REDEEM));

        // 3. 将赎回得到的 SY 卖掉，以换回之前借出的 PT
        let sy_left_after_swap = market::swap_sy_for_exact_pt_out_internal(
            yt_amount_in,
            sy_from_redeem,
            user_py_position,
            py_state_object,
            market::get_cached_exchange_rate(market_cache),
            market_cache,
            market_pool_object
        );

        // 4. 更新用户的利息，并将应计利息/费用存入金库
        yield_factory::deposit_to_vault(
            py::update_user_interest(
                yield_factory::interest_fee_rate(),
                market::get_cached_exchange_rate(market_cache),
                user_py_position,
                py_state_object
            ),
            py_state_object
        );

        // 5. 偿还在第一步中借出的 PT。
        py::repay_pt_amount(user_py_position, py_state_object, pt_borrowed);

        // 6. 创建并发出交易事件，记录本次操作的详情。
        let swap_event = SwapYTEvent{
            market_state_address : object::object_address(&market_pool_object),
            expiry: market::market_expiry(market_pool_object),
            yt_amount: yt_amount_in,
            sy_amount: fungible_asset::amount(&sy_left_after_swap),
            exchange_rate: market::get_cached_exchange_rate(market_cache),
        };
        event::emit<SwapYTEvent>(swap_event);

        // 7. 返回交易后剩余的 SY，这是用户的最终所得。
        sy_left_after_swap
    }

    public(package) fun swap_pt_to_sy_out_internal(
        pt_amount_in: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :(u64, FixedPoint64, FixedPoint64) {
        // 1. 调用核心交易函数。注意，因为是卖出 PT (即向池中增加PT)，所以传入的 PT 数量是负数。
        let (net_sy_change, new_amm_rate_fp, new_fee_rate_fp, _, _) = market::execute_trade_core(
            fixed_point64_with_sign::neg(fixed_point64_with_sign::from_uint64(pt_amount_in)),
            market_cache,
            market_pool_object
        );

        // 2. 将返回的结果进行处理并返回
        // net_sy_change 是正数，代表从池中换出的 SY 数量
        let sy_amount_out = fixed_point64_with_sign::truncate(net_sy_change);
        let new_fee_rate = fixed_point64::from_u128(fixed_point64_with_sign::get_raw_value(new_fee_rate_fp));
        let new_amm_rate = fixed_point64::from_u128(fixed_point64_with_sign::get_raw_value(new_amm_rate_fp));

        (sy_amount_out, new_fee_rate, new_amm_rate)
    }


    fun calc_max_pt_out_for_sy_in(
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :u64 {
        // 1. 根据缓存中的费率锚点和缩放因子，计算出隐含利率
        let implied_rate = math_fixed64_with_sign::exp(
            math_fixed64_with_sign::mul(fixed_point64_with_sign::sub(market::get_cached_fee_rate(market_cache),
                market::get_cached_rate_anchor(market_cache)), market::get_cached_rate_scalar(market_cache))
        );
        // 2. 获取池中总的 PT 数量
        let total_pt_fp = fixed_point64::encode(market::get_market_total_pt(market_pool_object));

        // 3. 核心计算：基于AMM的恒定乘积公式变体，计算出理论上的最大可卖出PT量
        // 公式较为复杂，本质是求解一个方程，找出使得池子状态达到某个边界条件的PT量
        let max_pt_out_fp = fixed_point64::mul_fp(
            fixed_point64::sub_fp(
                total_pt_fp,
                fixed_point64::mul_fp(
                    fixed_point64_with_sign::remove_sign(
                        math_fixed64_with_sign::div(implied_rate, fixed_point64_with_sign::add(implied_rate, fixed_point64_with_sign::one()))
                    ),
                    fixed_point64::add_fp(market::get_cached_total_asset(market_cache), total_pt_fp)
                )
            ),
            // 4. 乘以一个 0.999 的系数作为安全缓冲，防止极端情况
            fixed_point64::fraction_u128(999, 1000)
        );

        // 5. 将计算结果（定点数）转换为整数并返回
        fixed_point64::decode_round_down(max_pt_out_fp)
    }

    fun calc_max_pt_in_for_sy_out(
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :u64 {
        // 获取池中总PT和总资产（SY的底层资产）的数量
        let total_pt_fp = fixed_point64_with_sign::from_uint64(market::get_market_total_pt(market_pool_object));
        let total_asset_fp = fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(market::get_cached_total_asset(market_cache)), true);

        // 初始化二分搜索的边界
        let low_bound = fixed_point64_with_sign::zero();
        let high_bound = fixed_point64_with_sign::sub(total_asset_fp, fixed_point64_with_sign::one());

        // 通过二分搜索寻找价格曲线斜率大于等于0的临界点
        while (fixed_point64_with_sign::less(low_bound, high_bound)) {
            let mid_point = math_fixed64_with_sign::div(fixed_point64_with_sign::add(fixed_point64_with_sign::add(low_bound, high_bound), fixed_point64_with_sign::one()), fixed_point64_with_sign::from_uint64(2));
            // 如果在 mid_point 处的斜率小于0，说明超过了临界点，需要缩小上界
            if (fixed_point64_with_sign::less(calc_slope(mid_point, total_pt_fp, total_asset_fp, market_cache), fixed_point64_with_sign::zero())) {
                high_bound = fixed_point64_with_sign::sub(mid_point, fixed_point64_with_sign::one());
                continue
            };
            // 否则，临界点可能在右侧，提升下界
            low_bound = mid_point;
        };

        // 计算一个基于总资产 96% 的硬性安全上限
        let safety_limit = fixed_point64_with_sign::sub(
            math_fixed64_with_sign::mul(fixed_point64_with_sign::create_from_rational(96, 100, true),
                fixed_point64_with_sign::add(total_pt_fp, total_asset_fp)),
            total_pt_fp);

        // 返回二分搜索找到的临界值和硬性安全上限中的较小者，确保安全
        if (fixed_point64_with_sign::greater_or_equal(low_bound, safety_limit)) {
            fixed_point64_with_sign::truncate(safety_limit)
        } else {
            fixed_point64_with_sign::truncate(low_bound)
        }
    }

    fun calc_slope(
        x_position: FixedPoint64WithSign,
        total_pt: FixedPoint64WithSign,
        total_asset: FixedPoint64WithSign,
        market_state_cache: &MarketPoolCache
    ) : FixedPoint64WithSign {
        // 核心公式中的两个分母项
        let denominator_term1 = fixed_point64_with_sign::sub(total_asset, x_position);
        let denominator_term2 = fixed_point64_with_sign::add(x_position, total_pt);

        // 断言分母不为零，防止计算错误
        assert!(fixed_point64_with_sign::less(fixed_point64_with_sign::zero(), denominator_term1), E_INVALID_MATH_STATE_DENOMINATOR_ZERO);
        assert!(fixed_point64_with_sign::less(fixed_point64_with_sign::zero(), denominator_term2), E_INVALID_MATH_STATE_DENOMINATOR_ZERO);

        // 这是从AMM定价函数的导数推导出的复杂公式，用于计算瞬时价格
        // 它结合了池子的当前状态和市场的利率参数
        fixed_point64_with_sign::sub(
            market::get_cached_rate_anchor(market_state_cache),
            math_fixed64_with_sign::mul(
                fixed_point64_with_sign::sub(
                    fixed_point64_with_sign::from_uint64((((
                        fixed_point64_with_sign::get_raw_value(x_position) as u256) * ((fixed_point64_with_sign::get_raw_value(total_pt) as u256) + (fixed_point64_with_sign::get_raw_value(total_asset) as u256)) /
                        ((fixed_point64_with_sign::get_raw_value(denominator_term2) as u256) * (fixed_point64_with_sign::get_raw_value(denominator_term1) as u256))
                    ) as u64)),
                    math_fixed64_with_sign::ln(math_fixed64_with_sign::div(denominator_term2, denominator_term1))
                ),
                math_fixed64_with_sign::div(fixed_point64_with_sign::one(), market::get_cached_rate_scalar(market_state_cache))
            )
        )
    }

    #[view]
    public fun get_approx_pt_out_for_net_sy_in_with_oracle_price(
        net_sy_in: u64,
        min_pt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : (u64, FixedPoint64, FixedPoint64) {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        // 根据当前市场状态和预言机价格，创建一个市场状态的 Cache
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        get_approx_pt_out_for_net_sy_in_internal(
            net_sy_in,
            min_pt_out,
            &market_state_cache,
            market_pool_object
        )
    }

    fun get_approx_pt_out_for_net_sy_in_internal(
        net_sy_in: u64,
        min_pt_out: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) : (u64, FixedPoint64, FixedPoint64) {
        let low_bound = 1;
        let high_bound = calc_max_pt_out_for_sy_in(market_cache, market_pool_object);

        assert!(high_bound >= min_pt_out,  error::aborted(E_MARKET_INSUFFICIENT_PT_FOR_SWAP));

        // --- 初始化返回值 ---
        let final_pt_out = 0;
        let fee_amount = fixed_point64::zero();
        let price_impact = fixed_point64::zero();

        // --- 开始二分查找 ---
        while (low_bound <= high_bound) {
            // 猜测一个 PT 输出量
            let guess_pt_out = (high_bound + low_bound) / 2;

            // 反向计算，为了得到 `guess_pt_out` 需要输入多少 SY
            let (sy_needed, current_fee, current_impact) = get_sy_amount_in_for_exact_pt_out_internal(
                guess_pt_out,
                market_cache,
                market_pool_object
            );

            // 更新手续费和价格影响
            fee_amount = current_fee;
            price_impact = current_impact;

            // 比较并调整边界
            if (sy_needed <= net_sy_in) {
                // 如果需要的 SY <= 用户的预算，说明 `guess_pt_out` 是一个可行的解
                final_pt_out = guess_pt_out;

                // 优化：如果成本已经非常接近预算（误差0.1%内），提前结束
                if (sy_needed >= (((net_sy_in as u256) * (999000000 as u256) / (1000000000 as u256)) as u64)) {
                    break;
                };

                // 尝试在更高的区间寻找更优解
                // 源码中的 continue 和这里的 low_bound 赋值逻辑上是等效的
                low_bound = guess_pt_out + 1;
            } else {
                // 如果需要的 SY > 预算，说明 `guess_pt_out` 太大了，缩小上界
                high_bound = guess_pt_out - 1;
            };
        };

        (final_pt_out, fee_amount, price_impact)
    }



    fun get_approx_yt_out_for_net_sy_in_internal(
        net_sy_in: u64,
        min_yt_out: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) : (u64, u64, FixedPoint64, FixedPoint64) {
        // --- 初始化二分查找的边界 ---
        // 下界 low_bound: 初始猜测值。基于 net_sy_in 和当前利率进行一个粗略估算
        let low_bound = fixed_point64::decode_round_down(
            sy::sy_to_asset(
            market::get_cached_index(market_cache),
            fixed_point64::encode(net_sy_in)
            )
        );
        // 上界 high_bound: 理论上能卖出的最大PT数量，这是一个安全的上界。
        let high_bound = calc_max_pt_in_for_sy_out(market_cache, market_pool_object);
        assert!(high_bound >= min_yt_out,  error::aborted(E_MARKET_INSUFFICIENT_PT_FOR_SWAP));
        // --- 初始化返回值 ---
        let final_yt_out = 0;
        let final_gross_sy_cost = 0;
        let fee_amount = fixed_point64::zero();
        let price_impact = fixed_point64::zero();

        // --- 开始二分查找 ---
        while (low_bound < high_bound) {
            // 1. 猜测一个 YT 输出量
            let guess_yt_out = (high_bound + low_bound) / 2;

            // 2. 计算卖出等量 PT 的收入
            let (sy_revenue_from_pt_sale, current_fee, current_impact) = swap_pt_to_sy_out_internal(
                guess_yt_out,
                market_cache,
                market_pool_object
            );
            // 更新手续费和价格影响
            fee_amount = current_fee;
            price_impact = current_impact;

            // 3. 计算铸造 `guess_yt_out` 个 YT+PT 的总成本
            let gross_sy_cost = fixed_point64::decode_round_down(
                sy::asset_to_sy_up(
                market::get_cached_index(market_cache),
                fixed_point64::encode(guess_yt_out)
                )
            );
            final_gross_sy_cost = gross_sy_cost; // 记录当前的总成本

            // 4. 计算净成本
            let net_sy_cost = gross_sy_cost - sy_revenue_from_pt_sale;

            // 5. 比较并调整边界
            if (net_sy_cost <= net_sy_in) {
                // 如果计算出的成本 <= 用户的预算，说明 `guess_yt_out` 是一个可行的解
                // 记录这个解，并尝试寻找一个更大的解（获得更多YT）
                final_yt_out = guess_yt_out;

                // 如果成本已经非常接近预算（误差0.1%内），提前结束。
                if (net_sy_cost >= (((net_sy_in as u256) * (999000000 as u256) / (1000000000 as u256)) as u64)) {
                    break;
                };

                // 当前解可行，继续在 [current_guess, high_bound] 区间搜索
                // 注意：源码这里的 continue 实际上是多余的，但逻辑上等同于 low_bound = guess_yt_out
                low_bound = guess_yt_out + 1;
            } else {
                // 如果计算出的成本 > 预算，说明 `guess_yt_out` 太大了，
                // 需要在更低的区间寻找解
                high_bound = guess_yt_out - 1;
            };
        };

        (final_yt_out, final_gross_sy_cost, fee_amount, price_impact)
    }

    #[view]
    public fun get_lp_out_for_single_sy_in(
        market_pool_object: Object<MarketPool>,
        py_state_object: Object<PyState>,
        sy_amount_in: u64
    ) : (u64, FixedPoint64, FixedPoint64) {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        // 步骤 1: 根据当前市场状态和预言机价格，创建一个市场状态的 Cache
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        // 步骤 2: 调用核心辅助函数 `add_approx_liquidity_single_sy`
        // 这个函数内部封装了复杂的 "Zap-in" 逻辑：它会计算如何最优地将输入的 sy_amount_in
        // 分割并兑换成 PT/SY 对。函数返回的是一个元组 (tuple)，包含多个值
        // 我们只取第一个返回值，它代表了为了配对，需要从市场上换取的 PT 数量
        let (pt_needed_for_pairing, _, _) = add_approx_liquidity_single_sy(
            fixed_point64::encode(sy_amount_in),
            &market_state_cache,
            market_pool_object
        );
        // 步骤 3: 调用另一个核心辅助函数 `swap_pt_to_sy_out_internal`
        // 这里的函数命名可能有些误导。根据上下文，它的作用更可能是：
        // “给定需要换取的 pt_needed_for_pairing，计算出与之配对的 SY 数量是多少”
        // 它返回了配对所需的 SY 数量，以及交易滑点/价格等信息
        let (sy_needed_for_pairing, price_impact_1, price_impact_2) = swap_pt_to_sy_out_internal(
            pt_needed_for_pairing,
            &market_state_cache,
            market_pool_object
        );
        // 步骤 4: 使用计算出的最优 PT/SY 对，调用基础函数计算最终的 LP 产出
        let lp_out = get_lp_out_from_mint_lp(
            market_pool_object,
            pt_needed_for_pairing,
            sy_needed_for_pairing
        );
        // 返回最终的 LP 数量，以及两次计算中产生的价格影响/费率等附加信息
        (lp_out, price_impact_1, price_impact_2)
    }


    /// 计算出: 向资金池中添加 X 数量的 PT 和 Y 数量的 SY 能获得的 LP 的数量
    public fun get_lp_out_from_mint_lp(
        market_pool_object: Object<MarketPool>,
        pt_amount_in: u64,
        sy_amount_in: u64
    ) : u64 {
        // 定义将要返回的 LP 代币数量
        let lp_out: u64;
        // 获取当前池中 LP 代币的总量
        let total_lp_supply = market::get_market_lp_supply(market_pool_object);
        // 检查池子是否是空的 (即首次添加流动性)
        if (total_lp_supply == 0) {
            // --- case 1: 首次添加流动性 ---
            // 初始 LP 数量是两种代币数量乘积的平方根
            // 用于建立 LP token 的初始价值
            // 计算时为了防止溢出，先将 u64 转换为 u128
            lp_out = (math128::sqrt((pt_amount_in as u128) * (sy_amount_in as u128)) as u64);
            assert!(lp_out >= 1000, error::aborted(E_MARKET_LIQUIDITY_TOO_LOW));
            lp_out -= 1000
        } else {
            // --- case 2: 向已有池子中添加流动性 ---
            // 分别计算投入的 PT 和 SY 对应当前池子比例，应该获得多少 LP
            let lp_share_from_pt = (((pt_amount_in as u128) * (market::get_market_lp_supply(market_pool_object) as u128) / (market::get_market_total_pt(market_pool_object) as u128)) as u64);
            let lp_share_from_sy = (((pt_amount_in as u128) * (market::get_market_lp_supply(market_pool_object) as u128) / (market::get_market_total_sy(market_pool_object) as u128)) as u64);
            assert!(lp_share_from_pt > 0 && lp_share_from_sy > 0, error::aborted(E_MARKET_LP_AMOUNT_IS_ZERO));
            lp_out = math64::min(lp_share_from_pt, lp_share_from_sy);
        };
        lp_out
    }

    #[view]
    public fun get_pt_out_for_exact_sy_in_with_oracle_price(
        sy_amount_in: u64,
        min_pt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : (u64, u64, FixedPoint64, FixedPoint64) {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        get_pt_out_for_exact_sy_in_internal(
            sy_amount_in,
            min_pt_out,
            &market_state_cache,
            market_pool_object
        )
    }

    #[view]
    public fun get_pt_out_for_exact_sy_in_with_oracle_price_v2(
        sy_amount_in: u64,
        min_pt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : u64 {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        let (final_pt_out, _, _, _) = get_pt_out_for_exact_sy_in_internal(
            sy_amount_in,
            min_pt_out,
            &market_state_cache,
            market_pool_object
        );
        final_pt_out
    }

    fun get_pt_out_for_exact_sy_in_internal(
        sy_amount_in: u64,
        min_pt_out: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) : (u64, u64, FixedPoint64, FixedPoint64) {

        let low_bound = 1;
        // 计算池子当前能换出的最大 PT 数量作为上界
        let high_bound = calc_max_pt_out_for_sy_in(
            market_cache,
            market_pool_object
        );
        // 检查池子是否有足够的 PT 满足用户的最低要求
        assert!(high_bound >= min_pt_out, error::aborted(E_MARKET_INSUFFICIENT_PT_FOR_SWAP));

        // --- 初始化返回值 ---
        let final_pt_out = 0;
        let final_sy_in = 0;
        let fee_amount = fixed_point64::zero();
        let price_impact = fixed_point64::zero();

        // --- 开始二分查找 ---
        while (low_bound <= high_bound) {
            let guess_pt_out = (high_bound + low_bound) / 2;
            let (sy_needed, current_fee, current_impact) = get_sy_amount_in_for_exact_pt_out_internal(
                guess_pt_out, market_cache,  market_pool_object
            );
            // 更新手续费和价格影响，以便即使循环提前中断也能返回最新的值
            fee_amount = current_fee;
            price_impact = current_impact;
            if (sy_needed <= sy_amount_in) {
                // 如果需要的 SY <= 用户拥有的 SY，说明 `guess_pt_out` 是一个可行的解
                // 我们记录这个解，并尝试寻找一个更大的解（即获得更多的 PT）
                final_pt_out = guess_pt_out;
                final_sy_in = sy_needed;

                // 如果找到的解已经非常接近用户的输入（例如，在 0.1% 的误差内），
                // 就没必要继续搜索了，直接中断循环
                if (sy_needed >= (((sy_amount_in as u256) * 999000000 / 1000000000) as u64)) {
                    break
                };
                // 尝试在更高的区间寻找更优解
                low_bound = guess_pt_out + 1;
            } else {
                // 如果需要的 SY > 用户拥有的 SY，说明 `guess_pt_out` 太大了，
                // 需要在更低的区间寻找解。
                high_bound = guess_pt_out - 1;
            };
        };
        // 最终检查：确保找到的解满足用户的最低输出要求
        assert!(final_pt_out >= min_pt_out, error::aborted(E_MARKET_INSUFFICIENT_PT_FOR_SWAP));
        (final_pt_out, final_sy_in, fee_amount, price_impact)
    }

    #[view]
    public fun get_sy_amount_in_for_exact_pt_out_with_oracle_price(
        exact_pt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : (u64, FixedPoint64, FixedPoint64) {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let current_exchange_rate = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
        );
        get_sy_amount_in_for_exact_pt_out(
            exact_pt_out,
            current_exchange_rate,
            py_state_object,
            market_pool_object
        )
    }

    #[view]
    public fun get_sy_amount_in_for_exact_pt_out_with_oracle_price_v2(
        exact_pt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : u64 {
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let current_exchange_rate = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
        );
        let (sy_in_amount, _, _) = get_sy_amount_in_for_exact_pt_out(
            exact_pt_out,
            current_exchange_rate,
            py_state_object,
            market_pool_object
        );
        sy_in_amount
    }

    public fun get_sy_amount_in_for_exact_pt_out(
        exact_pt_out: u64,
        exchange_rate: FixedPoint64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>,
    ) : (u64, FixedPoint64, FixedPoint64) {
        let market_state_cache = market::get_market_pool_cache(
            exchange_rate,
            market_pool_object,
            py_state_object
        );

        get_sy_amount_in_for_exact_pt_out_internal(
            exact_pt_out,
            &market_state_cache,
            market_pool_object
        )
    }

    public(package) fun get_sy_amount_in_for_exact_pt_out_internal(
        exact_pt_out: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) : (u64, FixedPoint64, FixedPoint64) {
        // 调用核心交易执行引擎来模拟交易。
        // 我们传入一个正数的 exact_pt_out，表示我们想“获得”这么多 PT
        let (sy_in_signed, price_impact_signed, fee_amount_signed, _, _) = market::execute_trade_core(
            fixed_point64_with_sign::from_uint64(exact_pt_out),
            market_cache,
            market_pool_object
        );

        // `execute_trade_core` 返回的 sy_in 是一个带符号的负数（表示输入）
        // 我们需要将其取反，变回正数，然后截断小数部分，得到最终需要的 SY 数量
        let sy_in_amount = fixed_point64_with_sign::truncate(
            fixed_point64_with_sign::neg(sy_in_signed)
        );
        // 手续费和价格影响也需要从带符号的定点数转换为标准的定点数
        let fee_amount = fixed_point64::from_u128(
            fixed_point64_with_sign::get_raw_value(fee_amount_signed)
        );
        let price_impact = fixed_point64::from_u128(
            fixed_point64_with_sign::get_raw_value(price_impact_signed)
        );

        (sy_in_amount, fee_amount, price_impact)
    }

    #[view]
    public fun get_sy_amount_in_for_exact_yt_out_with_oracle_price(
        exact_yt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : u64 {
        // 1. 从预言机处获取价格
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let current_exchange_rate = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
        );
        // 2. 调用上一层函数来获取总成本和卖出收入
        let (gross_sy_cost, sy_revenue_from_pt_sale, _, _) = get_sy_amount_in_for_exact_yt_out(
            exact_yt_out,
            current_exchange_rate,
            py_state_object,
            market_pool_object
        );
        // 重复断言，确保安全
        assert!(gross_sy_cost > sy_revenue_from_pt_sale, error::aborted(E_REPAY_SY_IN_EXCEEDS_EXPECTED_SY_IN));

        gross_sy_cost - sy_revenue_from_pt_sale
    }

    public fun get_sy_amount_in_for_exact_yt_out(
        exact_yt_out: u64,
        exchange_rate: FixedPoint64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : (u64, u64, FixedPoint64, FixedPoint64) {
        // 步骤 1: 创建市场状态缓存
        let market_state_cache = market::get_market_pool_cache(
            exchange_rate,
            market_pool_object,
            py_state_object
        );
        // 步骤 2: 计算铸造 `exact_yt_out` 数量的 YT+PT 所需的总 SY
        let gross_sy_cost = py::get_sy_amount_in_for_exact_py_out(
            exact_yt_out,
            exchange_rate,
            py_state_object
        );
        // 步骤 3: 计算卖出等量副产品 PT 能换回的 SY
        // 当你铸造 `exact_yt_out` 个 YT 时，会同时得到 `exact_yt_out` 个 PT
        let (sy_revenue_from_pt_sale, fee, price_impact) = swap_pt_to_sy_out_internal(
            exact_yt_out,
            &market_state_cache,
            market_pool_object
        );
        // 确保总成本 > 卖出副产品的收入。如果<=，说明可以零成本甚至负成本套利
        assert!(gross_sy_cost > sy_revenue_from_pt_sale, error::aborted(E_REPAY_SY_IN_EXCEEDS_EXPECTED_SY_IN));

        (gross_sy_cost, sy_revenue_from_pt_sale, fee, price_impact)
    }

    #[view]
    public fun get_sy_amount_out_for_exact_pt_in_with_oracle_price(
        pt_amount_in: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) :u64 {
        // 从预言机处获取价格
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let current_exchange_rate = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
        );
        get_sy_amount_out_for_exact_pt_in(
            pt_amount_in,
            current_exchange_rate,
            py_state_object,
            market_pool_object
        )
    }

    public fun get_sy_amount_out_for_exact_pt_in(
        pt_amount_in: u64,
        exchange_rate: FixedPoint64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) :u64 {
        // 创建市场状态缓存
        let market_state_cache = market::get_market_pool_cache(
            exchange_rate,
            market_pool_object,
            py_state_object
        );
        get_sy_amount_out_for_exact_pt_in_internal(
            pt_amount_in,
            &market_state_cache,
            market_pool_object
        )
    }

    fun get_sy_amount_out_for_exact_pt_in_internal(
        pt_amount_in: u64,
        market_cache: &MarketPoolCache,
        market_pool_object: Object<MarketPool>
    ) :u64 {
        let (sy_amount_out, _, _, _, _) = market::execute_trade_core(
            fixed_point64_with_sign::from_uint64(pt_amount_in),
            market_cache,
            market_pool_object
        );
        fixed_point64_with_sign::truncate(fixed_point64_with_sign::neg(sy_amount_out))
    }

    fun get_sy_amount_out_for_exact_yt_in_internal(
        exact_yt_in: u64,
        exchange_rate: FixedPoint64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : u64 {
        // 创建市场状态缓存
        let market_state_cache = market::get_market_pool_cache(
            exchange_rate,
            market_pool_object,
            py_state_object
        );
        // 步骤 2: 计算赎回 `exact_yt_in` 数量的 YT 能得到的总 SY 价值 (Gross Revenue)
        let gross_sy_revenue = fixed_point64::decode_round_down(
                sy::asset_to_sy(
                market::get_cached_exchange_rate(&market_state_cache),
                fixed_point64::encode(exact_yt_in)
            )
        );

        // 步骤 3: 计算买回等量 PT 所需的 SY 成本 (Cost of PT)
        let sy_cost_for_pt = get_sy_amount_out_for_exact_pt_in_internal(
            exact_yt_in,
            &market_state_cache,
            market_pool_object
        );

        gross_sy_revenue - sy_cost_for_pt
    }

    #[view]
    public fun get_sy_amount_out_for_exact_yt_in_with_oracle_price(
        exact_yt_in: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : u64 {
        // 从预言机处获取价格
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let current_exchange_rate = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
        );
        get_sy_amount_out_for_exact_yt_in_internal(
            exact_yt_in,
            current_exchange_rate,
            py_state_object,
            market_pool_object
        )
    }

    #[view]
    public fun get_yt_out_for_exact_sy_in_with_oracle_price(
        net_sy_in: u64,
        min_yt_out: u64,
        py_state_object: Object<PyState>,
        market_pool_object: Object<MarketPool>
    ) : (u64, FixedPoint64, FixedPoint64) {
        // 步骤 1: 创建市场状态缓存
        let sy_metadata = market::sy_metadata_address(market_pool_object);
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metadata)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        // 步骤 2: 调用内部的近似计算函数
        // 此函数会尝试不同的 YT 输出量，直到计算出的净 SY 成本接近 `net_sy_in`
        let (approx_yt_out, _, fee, price_impact) = get_approx_yt_out_for_net_sy_in_internal(
            net_sy_in,
            min_yt_out,
            &market_state_cache,
            market_pool_object
        );

        // 返回近似计算出的 YT 数量及相关费用信息
        (approx_yt_out, fee, price_impact)
    }

}
