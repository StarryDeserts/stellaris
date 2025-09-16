module stellaris::market_position {

    use std::string;
    use std::string::String;
    use aptos_std::math64;
    use aptos_std::smart_table;
    use aptos_std::smart_table::SmartTable;
    use aptos_std::string_utils;
    use aptos_framework::object;
    use aptos_framework::object::{Object, ConstructorRef};
    use stellaris::utils;

    const ONE_DAYS_MILLISECOND:u64 = 86400000;
    const SCALING_FACTOR:u64 = 100000000;

    struct MarketPosition has key {
        market_state_id: address,
        expiry: u64,
        yield_token: String,
        name: String,
        description: String,
        lp_amount: u64,
        expiry_days: u64,
        lp_amount_display: String,
        rewards_debt: SmartTable<address, u256>,
        rewards_harvested: SmartTable<address, u64>
    }

    public(package) fun open_position(
        constructor_ref: &ConstructorRef,
        market_pool_address: address,
        yield_token_name: String,
        expiry: u64,
    ) :Object<MarketPosition> {
        let signer = object::generate_signer(constructor_ref);

        let position_name = string::utf8(b"Stellaris LP | ");
        position_name.append(yield_token_name);
        position_name.append(string::utf8(b"Stellaris LP | "));
        position_name.append(string_utils::to_string(&expiry));

        // 创建一个新的 Market Position
        let maket_position = MarketPosition {
            market_state_id: market_pool_address,
            expiry,
            yield_token: yield_token_name,
            name: position_name,
            description: string::utf8(b"Stellaris Liquidity Position"),
            lp_amount: 0,
            expiry_days: (expiry - utils::now_milliseconds()) / ONE_DAYS_MILLISECOND,
            lp_amount_display: u64_to_float_string(0),
            rewards_debt: smart_table::new(),
            rewards_harvested: smart_table::new(),
        };
        move_to(&signer, maket_position);
        object::object_from_constructor_ref<MarketPosition>(constructor_ref)
    }

    public(package) fun increase_lp_amount(
        market_position_object: Object<MarketPosition>,
        amount_to_add: u64,
    ) acquires MarketPosition {
        let position = borrow_global_mut<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount += amount_to_add;
        set_expiry_days(position);
    }

    public(package) fun decrease_lp_amount(
        market_position_object: Object<MarketPosition>,
        amount_to_remove: u64,
    ) acquires MarketPosition {
        let position = borrow_global_mut<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount -= amount_to_remove;
        set_expiry_days(position);
    }


    /// TODO: SmartTable 不能直接返回给其它的模块进行调用，看来需要写 4 个方法了
    // public(package) fun borrow_reward_debt_harvested(
    //     market_position_object: Object<MarketPosition>
    // ) :(SmartTable<address, u256>, SmartTable<address, u64>) acquires MarketPosition {
    //     let position = borrow_global_mut<MarketPosition>(object::object_address(&market_position_object));
    //     (position.rewards_debt, position.rewards_harvested)
    // }

    public(package) fun delete_empty_position(
        market_position_object: Object<MarketPosition>
    ) acquires MarketPosition {
        let MarketPosition {
            market_state_id: _,
            expiry: _,
            yield_token: _,
            name: _,
            description: _,
            lp_amount: _,
            expiry_days: _,
            lp_amount_display: _,
            rewards_debt,
            rewards_harvested
        } = move_from<MarketPosition>(object::object_address(&market_position_object));

        // 显示的销毁两个 SmartTable
        rewards_debt.destroy_empty();
        rewards_harvested.destroy_empty();

    }

    public fun lp_amount(market_position_object: Object<MarketPosition>) :u64 acquires MarketPosition {
        let position = borrow_global<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount
    }

    public fun market_state_id(market_position_object: Object<MarketPosition>) :address acquires MarketPosition {
        let position = borrow_global<MarketPosition>(object::object_address(&market_position_object));
        position.market_state_id
    }

    fun set_expiry_days(market_position: &mut MarketPosition) {
        if (market_position.expiry > utils::now_milliseconds()) {
            market_position.expiry_days = (market_position.expiry - utils::now_milliseconds()) / ONE_DAYS_MILLISECOND;
        } else {
            market_position.expiry_days = 0;
        };
    }

    public(package) fun set_lp_amount(
        market_position_object: Object<MarketPosition>,
        new_lp_amount: u64
    ) acquires MarketPosition {
        let position = borrow_global_mut<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount = new_lp_amount;
        set_expiry_days(position);
    }

    public(package) fun update_lp_display(
        market_position_object: Object<MarketPosition>,
    ) acquires MarketPosition {
        // 默认精度为 8
        let decimal: u8 = 8;
        // 调用格式化函数，并更新 position 的 lp_amount 的展示字段
        let position = borrow_global_mut<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount_display = u64_to_float_string_with_decimal_value(position.lp_amount, decimal);
    }

    public fun u64_to_float_string(amount: u64) :String {
        // 得到小数部分的前三位
        let decimal_part = amount % SCALING_FACTOR / 100000;
        // 得到整数部分
        let result_string = string_utils::to_string(&(amount / SCALING_FACTOR));
        // 拼接字符串
        if (decimal_part > 0) {
            result_string.append(string::utf8(b"."));
            if (decimal_part < 10) {
                result_string.append(string::utf8(b"00"));
            } else if (decimal_part < 100) {
                result_string.append(string::utf8(b"0"));
            };
            result_string.append(string_utils::to_string(&decimal_part));
        };
        result_string
    }

    public fun u64_to_float_string_with_decimal_value(
        raw_amount: u64,
        decimals: u8
    ) :String {
        let divisor = math64::pow(10, (decimals as u64));
        let decimal_part = raw_amount % divisor / math64::pow(10, ((decimals - 3) as u64));

        let result_string = string_utils::to_string(&(raw_amount / divisor));
        // 如果小数部分大于0，则拼接小数点和格式化后的小数
        if (decimal_part > 0) {
            result_string.append(string::utf8(b"."));
            // 补零操作，确保小数部分总是3位数
            if (decimal_part < 10) {
                result_string.append(string::utf8(b"00"));
            } else if (decimal_part < 100) {
                result_string.append(string::utf8(b"0"));
            };
            result_string.append(string_utils::to_string(&decimal_part));
        };
        result_string
    }
}
