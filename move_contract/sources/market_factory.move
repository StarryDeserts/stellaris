module stellaris::market_factory {

    use std::error;
    use aptos_framework::event;
    use aptos_framework::object;
    use aptos_framework::object::Object;
    use fixed_point64::fixed_point64::{Self, FixedPoint64};
    use stellaris::market::{create_pool, calc_market_pool_signer_and_address};
    use stellaris::math_fixed64_with_sign;
    use stellaris::fixed_point64_with_sign;
    use stellaris::utils;
    use stellaris::py;
    use stellaris::market_global;
    use stellaris::py::PyState;
    use stellaris::fixed_point64_with_sign::FixedPoint64WithSign;

    #[event]
    struct MarketCreatedEvent has store, drop {
        market_pool_address: address,
        pt_id: address,
        expiry: u64,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
        market_cap: u64,
    }

    public fun create_new_market_with_raw_values(
        py_state_object: Object<PyState>,
        scalar_root_raw: u128,
        scalar_root_is_positive: bool,
        initial_anchor_raw: u128,
        initial_anchor_is_positive: bool,
        ln_fee_rate_root_raw: u128,
        market_cap: u64
    ) {
        // 从原始值创建定点数对象
        let scalar_root = fixed_point64_with_sign::create_from_raw_value(scalar_root_raw, scalar_root_is_positive);
        let initial_anchor = fixed_point64_with_sign::create_from_raw_value(initial_anchor_raw, initial_anchor_is_positive);
        let ln_fee_rate_root = fixed_point64::from_u128(ln_fee_rate_root_raw);

        // 调用内部函数，执行创建市场的核心逻辑
        create_new_market_internal(py_state_object, scalar_root, initial_anchor, ln_fee_rate_root, market_cap);
    }

    fun create_new_market_internal(
        py_state_object: Object<PyState>,
        scalar_root: FixedPoint64WithSign,
        initial_anchor: FixedPoint64WithSign,
        ln_fee_rate_root: FixedPoint64,
        market_cap: u64
    ) {
        let py_state_expiry = py::expiry(py_state_object);
        // 检查到期时间是否满足最小间隔要求。即 PyState 的到期时间 > (当前时间 + 配置的最小间隔)
        assert!(py_state_expiry > utils::now_milliseconds() + market_global::get_min_expiry_interval(), error::out_of_range(1));
        // 检查费率是否过高 ln_fee_rate_root <= ln(1.05)
        let max_ln_fee_rate_root = math_fixed64_with_sign::ln(fixed_point64_with_sign::create_from_rational(105, 100, true));
        let ln_fee_rate_root_fp = fixed_point64_with_sign::create_from_raw_value(fixed_point64::to_u128(ln_fee_rate_root), true);
        assert!(fixed_point64_with_sign::less_or_equal(ln_fee_rate_root_fp, max_ln_fee_rate_root), error::aborted(2));
        // 检查 initial_anchor 是否 >= 1
        assert!(fixed_point64_with_sign::greater_or_equal(initial_anchor, fixed_point64_with_sign::one()), error::aborted(3));
        // 检查 scalar_root 是否不为零
        assert!(!fixed_point64_with_sign::is_zero(scalar_root), error::aborted(4));
        // 检查该市场是否已存在于全局配置中
        let (_, market_pool_address) = calc_market_pool_signer_and_address(
            object::object_address(&py_state_object),
            scalar_root,
            initial_anchor,
            ln_fee_rate_root
        );
        assert!(market_global::contains(market_pool_address), error::already_exists(5));
        // 将新计算出的 market_pool_address 添加到全局配置中，防止重复创建
        market_global::add(market_pool_address);
        // 调用 market 模块的 create 函数，实际创建市场对象，并返回其 address
        let new_market_address = create_pool(
            py_state_object,
            scalar_root,
            initial_anchor,
            ln_fee_rate_root,
            market_cap
        );
        // 发布 market 创建事件
        event::emit(MarketCreatedEvent {
            market_pool_address: new_market_address,
            pt_id: object::object_address(&py_state_object),
            expiry: py_state_expiry,
            scalar_root,
            initial_anchor,
            ln_fee_rate_root,
            market_cap
        });
    }


}
