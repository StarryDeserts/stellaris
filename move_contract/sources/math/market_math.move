module stellaris::market_math {

    use std::error;
    use fixed_point64::fixed_point64;
    use fixed_point64::fixed_point64::FixedPoint64;
    use stellaris::math_fixed64_with_sign;
    use stellaris::fixed_point64_with_sign::{Self, FixedPoint64WithSign};

    const ERR_MARKET_PROPORTION_CAN_NOT_BE_ONE:u64 = 1;
    const ERR_MARKET_RATE_SCALAR_NEGATIVE:u64 = 2;
    const ERR_MARKET_RATE_EXCHANGE_NEGATIVE:u64 = 3;
    const ERR_MARKET_PROPORTION_TOO_HIGH:u64 = 4;
    const ERR_MARKET_EXCHANGE_RATE_BELOW_ONE:u64 = 5;

    /// 计算 AMM 的瞬时汇率
    /// 这是协议的定价核心，综合了所有参数来决定当前 PT 相对于 SY 的价格
    /// 公式：ExchangeRate = (log_proportion(NewProportion) / RateScalar) + RateAnchor
    public fun get_exchange_rate(
        total_asset: FixedPoint64WithSign, // 池中总资产量 (SY 换算成底层资产)
        total_pt: FixedPoint64WithSign, // 池中 PT 的总量
        rate_scalar: FixedPoint64WithSign, // 当前的利率缩放因子
        rate_anchor: FixedPoint64WithSign, // 当前的利率锚定值
        delta_pt: FixedPoint64WithSign // 本次交易中 PT 的变化量 (卖出 PT 为负，买入 PT 为正)
    ) : FixedPoint64WithSign {
        // 确保交易后的 PT 总量不会变为负数
        assert!(
            fixed_point64_with_sign::greater_or_equal(total_pt, delta_pt),
            error::invalid_argument(ERR_MARKET_RATE_EXCHANGE_NEGATIVE)
        );
        // 1. 计算交易后的  PT 的比例
        // NewProportion = (total_pt - delta_pt) / (total_pt + total_asset)
        let new_proportion = math_fixed64_with_sign::div(
            fixed_point64_with_sign::sub(total_pt, delta_pt),
            fixed_point64_with_sign::add(total_pt, total_asset)
        );
        // 断言：为防止极端情况和价格操纵，限制单次交易能改变的池子比例
        assert!(
            fixed_point64_with_sign::less(new_proportion, fixed_point64_with_sign::create_from_rational(96, 100, true)),
            error::invalid_argument(ERR_MARKET_PROPORTION_TOO_HIGH)
        );
        // 2. 计算对数比例项
        let log_prop_term = log_proportion(new_proportion);
        // 3. 计算最终的汇率
        let exchange_rate = fixed_point64_with_sign::add(
            math_fixed64_with_sign::div(log_prop_term, rate_scalar),
            rate_anchor
        );
        // 断言：汇率必须大于等于1 (因为 PT 在到期前总是有折价的)
        assert!(
            fixed_point64_with_sign::greater_or_equal(exchange_rate, fixed_point64_with_sign::one()),
            error::invalid_argument(ERR_MARKET_EXCHANGE_RATE_BELOW_ONE)
        );

        exchange_rate
    }


    /// 根据隐含利率和剩余时间计算出市场汇率
    public fun get_exchange_rate_from_implied_rate(
       implied_rate: FixedPoint64, // 年化隐含利率 (例如 0.05 代表 5%)
       time_to_expiry_ms: u64 // 距离到期日的剩余时间（毫秒）
    ) : FixedPoint64WithSign {
        // 1. 计算时间部分： implied_rate * (time_to_expiry_ms / 31536000000)
        let exponent = fixed_point64::mul_div_fp(
            implied_rate,
            fixed_point64::encode(time_to_expiry_ms),
            fixed_point64::encode(31536000000)
        );
        // 2. 将结果转换为带符号的定点数
        let exponent_with_sign = fixed_point64_with_sign::create_from_raw_value(
            fixed_point64::to_u128(exponent),
            true // 结果总为正数
        );
        // 3. 计算 e 的指数，得到最终的汇率
        math_fixed64_with_sign::exp(exponent_with_sign)
    }

    /// 计算利率锚定值。这是一个动态调整的目标利率，AMM会围绕这个利率进行定价。
    public fun get_rate_anchor(
        total_pt: FixedPoint64, // 池中 PT 的总量
        last_ln_implied_rate: FixedPoint64, // 上一笔交易的年化隐含利率
        total_asset: FixedPoint64, // 池中总资产量（SY 换算成底层资产）
        rate_scalar: FixedPoint64WithSign, // 当前的利率缩放因子
        time_to_expiry_ms: u64 // 距离到期日的剩余时间（毫秒）
    ) :FixedPoint64WithSign {
        // 1. 计算目标汇率：即基于上一次隐含利率计算出的理论汇率
        let target_exchange_rate = get_exchange_rate_from_implied_rate(
            last_ln_implied_rate,
            time_to_expiry_ms
        );
        // 2. 计算当前池中 PT 的比例
        let pt_proportion = fixed_point64::div_fp(
            total_pt,
           fixed_point64::add_fp(total_pt, total_asset)
        );
        let pt_proportion_with_sign = fixed_point64_with_sign::create_from_raw_value(
            fixed_point64::to_u128(pt_proportion),
            true
        );
        // 3. 计算对数比例项
        let log_prop_term = log_proportion(
            pt_proportion_with_sign
        );
        // 4. 计算最终的 Rate Anchor
        fixed_point64_with_sign::sub(
            target_exchange_rate,
            math_fixed64_with_sign::div(log_prop_term, rate_scalar)
        )
    }

    /// 计算一个随时间线性衰减的“利率缩放因子”
    public fun get_rate_scalar(
        scalar_root: FixedPoint64WithSign, // 利率缩放因子的基数，在市场创建时设定
        time_to_expiry_ms: u64 // 距离到期日的剩余时间（毫秒）
    ) :FixedPoint64WithSign {
        // 计算利率的缩放因子
        let rate_scalar = math_fixed64_with_sign::mul_div(
            scalar_root,
            fixed_point64_with_sign::from_uint64(31536000000), // 31536000000 为一年的毫秒数常量
            fixed_point64_with_sign::from_uint64(time_to_expiry_ms)
        );
        // 确保计算除的缩放因子为正数
        assert!(fixed_point64_with_sign::is_positive(rate_scalar), error::invalid_argument(ERR_MARKET_RATE_SCALAR_NEGATIVE));
        rate_scalar
    }

    fun log_proportion(proportion: FixedPoint64WithSign) :FixedPoint64WithSign {
        // 确保比例不等于 1，否则会导致除零错误
        assert!(!fixed_point64_with_sign::is_equal(proportion, fixed_point64_with_sign::one()), error::invalid_argument(ERR_MARKET_PROPORTION_CAN_NOT_BE_ONE));

        // 计算 proportion / (1 - proportion) 并返回结果
        math_fixed64_with_sign::ln(
            math_fixed64_with_sign::div(
                proportion,
                fixed_point64_with_sign::sub(fixed_point64_with_sign::one(), proportion)
            )
        )
    }

}
