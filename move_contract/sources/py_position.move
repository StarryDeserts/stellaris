module stellaris::py_position {

    use std::signer;
    use std::string::{Self, String};
    use aptos_std::string_utils::to_string;
    use aptos_framework::event;
    use aptos_framework::object::{Self, ConstructorRef, Object};
    use fixed_point64::fixed_point64::{Self, FixedPoint64};
    use stellaris::utils;

    const ONE_DAYS_MILLISECOND:u64 = 86400000;
    const SCALING_FACTOR:u64 = 100000000;

    struct PyPosition has key {
        py_state_id: address,
        name: String,
        description: String,
        pt_balance: u64,
        yt_balance: u64,
        yield_token: String,
        expiry: u64,
        pt_balance_display: String,
        yt_balance_display: String,
        expiry_days: u64,
        index: FixedPoint64,
        py_index: FixedPoint64,
        accured: FixedPoint64,
    }

    #[event]
    struct CreatePositionEvent has store, drop {
        position_object_id: address,
        py_state_id: address,
        owner_address: address
    }

    public(package) fun open_position(
        constructor_ref: &ConstructorRef,
        py_state_id: address,
        yield_token_name: String,
        expiry: u64,
    ) : Object<PyPosition> {
        let position_name = string::utf8(b"Stellaris PT&YT | ");
        position_name.append(yield_token_name);
        position_name.append(string::utf8(b" Pool "));
        position_name.append(to_string(&expiry));
        let signer = object::generate_signer(constructor_ref);

        // 创建一个新的 Py Position
        let py_position = PyPosition {
            py_state_id,
            name: position_name,
            description: string::utf8(b"Stellaris PT & YT Position"),
            pt_balance: 0,
            yt_balance: 0,
            yield_token: yield_token_name,
            expiry,
            pt_balance_display: u64_to_float_string(0),
            yt_balance_display: u64_to_float_string(0),
            expiry_days: (expiry - utils::now_milliseconds()) / ONE_DAYS_MILLISECOND,
            index: fixed_point64::zero(),
            py_index: fixed_point64::zero(),
            accured: fixed_point64::zero(),
        };
        move_to(&signer, py_position);
        let create_position_event = CreatePositionEvent{
            position_object_id: object::address_from_constructor_ref(constructor_ref),
            py_state_id,
            owner_address: signer::address_of(&signer)
        };
        event::emit<CreatePositionEvent>(create_position_event);
        object::object_from_constructor_ref<PyPosition>(constructor_ref)
    }

    public(package) fun set_accured(
        position_object: Object<PyPosition>,
        new_accured: FixedPoint64
    ) acquires PyPosition {
        let position_data = borrow_global_mut<PyPosition>(object::object_address(&position_object));
        position_data.accured = new_accured;
    }

    fun set_expiry_days(py_positon: &mut PyPosition) {
        if (py_positon.expiry > utils::now_milliseconds()) {
            py_positon.expiry_days = (py_positon.expiry - utils::now_milliseconds()) / ONE_DAYS_MILLISECOND;
        } else {
            py_positon.expiry_days = 0;
        };
    }

    public(package) fun set_index(
        position_object: Object<PyPosition>,
        new_index: FixedPoint64
    ) acquires PyPosition {
        let position_data = borrow_global_mut<PyPosition>(object::object_address(&position_object));
        position_data.index = new_index;
    }

    public(package) fun set_py_index(
        position_object: Object<PyPosition>,
        new_py_index: FixedPoint64
    ) acquires PyPosition {
        let position_data = borrow_global_mut<PyPosition>(object::object_address(&position_object));
        position_data.py_index = new_py_index;
    }

    public(package) fun set_yt_balance(
        position_object: Object<PyPosition>,
        new_yt_balance: u64
    ) acquires PyPosition {
        let position_data = borrow_global_mut<PyPosition>(object::object_address(&position_object));
        position_data.yt_balance = new_yt_balance;
        position_data.yt_balance_display = u64_to_float_string(new_yt_balance);
        set_expiry_days(position_data);
    }

    public(package) fun set_pt_balance(
        position_object: Object<PyPosition>,
        new_pt_balance: u64
    ) acquires PyPosition {
        let position_data = borrow_global_mut<PyPosition>(object::object_address(&position_object));
        position_data.pt_balance = new_pt_balance;
        position_data.pt_balance_display = u64_to_float_string(new_pt_balance);
        set_expiry_days(position_data);
    }

    public fun u64_to_float_string(amount: u64) :String {
        // 得到小数部分的前三位
        let decimal_part = amount % SCALING_FACTOR / 100000;
        // 得到整数部分
        let result_string = to_string(&(amount / SCALING_FACTOR));
        // 拼接字符串
        if (decimal_part > 0) {
            result_string.append(string::utf8(b"."));
            if (decimal_part < 10) {
                result_string.append(string::utf8(b"00"));
            } else if (decimal_part < 100) {
                result_string.append(string::utf8(b"0"));
            };
            result_string.append(to_string(&decimal_part));
        };
        result_string
    }

    public fun py_state_id(position_object: Object<PyPosition>) :address acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).py_state_id
    }

    public fun name(position_object: Object<PyPosition>) :String acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).name
    }

    public fun description(position_object: Object<PyPosition>) :String acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).description
    }

    public fun pt_balance(position_object: Object<PyPosition>) :u64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).pt_balance
    }

    public fun yt_balance(position_object: Object<PyPosition>) :u64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).yt_balance
    }

    public fun py_amount(position_object: Object<PyPosition>) :(u64, u64) acquires PyPosition {
        let position_data = borrow_global<PyPosition>(object::object_address(&position_object));
        let pt_balance = position_data.pt_balance;
        let yt_balance = position_data.yt_balance;
        (pt_balance, yt_balance)
    }

    public fun yield_token(position_object: Object<PyPosition>) :String acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).yield_token
    }

    public fun expiry(position_object: Object<PyPosition>) :u64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).expiry
    }

    public fun index(position_object: Object<PyPosition>) :FixedPoint64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).index
    }

    public fun py_index(position_object: Object<PyPosition>) :FixedPoint64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).py_index
    }

    public fun accured(position_object: Object<PyPosition>) :FixedPoint64 acquires PyPosition {
        borrow_global<PyPosition>(object::object_address(&position_object)).accured
    }



}
