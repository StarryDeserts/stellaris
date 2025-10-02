module stellaris::market_position {


    use aptos_std::math64;
    use aptos_framework::event;
    use aptos_std::string_utils;
    use std::string::{Self, String};
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_std::smart_vector::{Self, SmartVector};

    use aptos_framework::object::{Self, Object, ConstructorRef};

    use stellaris::utils;
    use stellaris::package_manager::{get_resource_address, get_signer};


    const ONE_DAYS_MILLISECOND:u64 = 86400000;
    const SCALING_FACTOR:u64 = 100000000;

    struct MarketPositionRegistry has key {
        user_position_address: SmartTable<address, SmartVector<address>>
    }

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

    struct MarketPositionView has copy, drop {
        market_state_id: address,
        yield_token: String,
        description: String,
        expiry_days: u64,
        lp_amount_display: String
    }

    #[event]
    struct CreateMarketPositionEvent has store, drop {
        owner_address: address,
        position_object_id: address,
        market_pool_id: address
    }

    fun init_module(publisher: &signer) {
        let py_position_registry = MarketPositionRegistry {
            user_position_address: smart_table::new<address, SmartVector<address>>()
        };
        move_to(&get_signer(), py_position_registry);
    }

    public(package) fun open_position(
        constructor_ref: &ConstructorRef,
        user_address: address,
        market_pool_address: address,
        yield_token_name: String,
        expiry: u64,
    ) :Object<MarketPosition> acquires MarketPositionRegistry {
        let market_position_registry = borrow_global_mut<MarketPositionRegistry>(get_resource_address());
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
        let create_position_event = CreateMarketPositionEvent{
            owner_address: user_address,
            position_object_id: object::address_from_constructor_ref(constructor_ref),
            market_pool_id: market_pool_address
        };
        event::emit<CreateMarketPositionEvent>(create_position_event);
        if (market_position_registry.user_position_address.contains(user_address)) {
            let user_position_list = market_position_registry.user_position_address.borrow_mut(user_address);
            user_position_list.push_back(object::address_from_constructor_ref(constructor_ref));
        } else {
            let empty_vector = smart_vector::empty<address>();
            empty_vector.push_back(object::address_from_constructor_ref(constructor_ref));
            market_position_registry.user_position_address.add(user_address, empty_vector);
        };
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

    #[view]
    public fun get_user_py_position_address(user_address: address) :vector<address> acquires MarketPositionRegistry {
        borrow_global<MarketPositionRegistry>(get_resource_address()).user_position_address.borrow(user_address).to_vector()
    }

    #[view]
    public fun lp_amount(market_position_object: Object<MarketPosition>) :u64 acquires MarketPosition {
        let position = borrow_global<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount
    }

    #[view]
    public fun market_state_id(market_position_object: Object<MarketPosition>) :address acquires MarketPosition {
        let position = borrow_global<MarketPosition>(object::object_address(&market_position_object));
        position.market_state_id
    }

    #[view]
    public fun lp_amount_display(market_position_object: Object<MarketPosition>) :String acquires MarketPosition {
        let position = borrow_global<MarketPosition>(object::object_address(&market_position_object));
        position.lp_amount_display
    }

    #[view]
    public fun yield_token(position_object: Object<MarketPosition>) :String acquires MarketPosition {
        borrow_global<MarketPosition>(object::object_address(&position_object)).yield_token
    }

    #[view]
    public fun get_market_position_info(position_object: Object<MarketPosition>) :MarketPositionView acquires MarketPosition {
        let user_market_position = borrow_global<MarketPosition>(object::object_address(&position_object));
        MarketPositionView {
            market_state_id: user_market_position.market_state_id,
            yield_token: user_market_position.yield_token,
            description: user_market_position.description,
            expiry_days: user_market_position.expiry_days,
            lp_amount_display: user_market_position.lp_amount_display
        }
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
