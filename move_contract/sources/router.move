module stellaris::router {
    use std::error;
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::fungible_asset::FungibleAsset;
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use aptos_framework::primary_fungible_store;
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
        assert!(market::get_market_total_pt(market_pool_object) > 0, error::aborted(2));

        let sy_metatda = fungible_asset::store_metadata(py::sy_metadata_address(py_state_object));
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        // 取出用户的 sy 资产
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);
        // 3. 从预言机获取底层资产的当前价格
        let current_price = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128)
        );

        // 4. 为用户创建一个新的流动性仓位对象
        let constructor_ref = &object::create_object(signer::address_of(user));
        let new_market_position = market_position::open_position(
            constructor_ref,
            object::object_address(&market_pool_object),
            signer::address_of(user),
            fungible_asset::name(sy_metatda),
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
        assert!(market_position::lp_amount(new_market_position) >= min_lp_out, error::aborted(3));
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
        let sy_metatda = fungible_asset::store_metadata(py::sy_metadata_address(py_state_object));
        let current_price = fixed_point64::from_u128(
            (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128)
        );
        let market_state_cache = market::get_market_pool_cache(
            current_price,
            market_pool_object,
            py_state_object
        );
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);
        // 3. 检查用户输入是否有效：想要的精确数量不能小于指定的最小数量
        assert!(exact_pt_out >= min_pt_out, error::aborted(10));

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
        assert!(exact_pt_out >= min_pt_out, error::aborted(11));

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
        let sy_metatda = fungible_asset::store_metadata(py::sy_metadata_address(py_state_object));
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128)
            ),
            market_pool_object,
            py_state_object
        );
        let if_sy = primary_fungible_store::is_balance_at_least(signer::address_of(user), sy_metatda, sy_amount);
        assert!(if_sy, error::aborted(13));
        let user_sy_balance = primary_fungible_store::withdraw(user, sy_metatda, sy_amount);

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
        assert!(yt_received >= min_yt_out, error::aborted(5));
        assert!(yt_amount_out_approx >= min_yt_out, error::aborted(6));
        assert!(yt_received >= yt_amount_out_approx, error::aborted(7));

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
        assert!(user_yt_balance >= exact_yt_in, error::aborted(8));

        // 3. 创建市场状态缓存
        let sy_metatda = fungible_asset::store_metadata(py::sy_metadata_address(py_state_object));
        let market_state_cache = market::get_market_pool_cache(
            fixed_point64::from_u128(
                (oracle::get_asset_price(object::object_address(&sy_metatda)) as u128)
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
        assert!(fungible_asset::amount(&sy_coin_out) >= min_sy_out, error::aborted(9));

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
        assert!(fungible_asset::amount(&sy_from_redeem) > 0, error::aborted(4));

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

    //
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
        assert!(fixed_point64_with_sign::less(fixed_point64_with_sign::zero(), denominator_term1), 1);
        assert!(fixed_point64_with_sign::less(fixed_point64_with_sign::zero(), denominator_term2), 1);

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

}
