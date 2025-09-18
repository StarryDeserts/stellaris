module stellaris::py {

    use std::bcs;
    use std::error;
    use std::signer;
    use std::string::String;
    use aptos_std::smart_vector::{Self, SmartVector};
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, FungibleStore, Metadata, FungibleAsset, create_store, store_metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;

    use stellaris::fixed_point64::{Self, FixedPoint64};
    use stellaris::sy;
    use stellaris::package_manager::{Self, get_signer, get_resource_address};

    use stellaris::utils;
    use stellaris::token_registry;
    use stellaris::py_position::{Self, PyPosition};

    const ERR_PY_STATE_ALREADY_EXITS:u64 = 1;
    const ERR_INVALID_PY_AMOUNT:u64 = 2;

    // 全局注册表，用于存储和索引协议中所有创建的 PyState 对象
    struct PyStore has key {
        all_py_states: SmartVector<address> // 存储所有创建的 PyState 的 Object 地址
    }

    // 代表一个 SY 资产和特定到期日的收益剥离池
    struct PyState has key {
        expiry: u64,
        name: String,
        pt_supply: u64,
        yt_supply: u64,
        sy_balance: Object<FungibleStore>,
        first_py_index: FixedPoint64,
        py_index_last_updated_timestamp: u64,
        py_index_stored: FixedPoint64,
        last_collect_interest_index: FixedPoint64,
        total_sy_interest_for_treasury: FixedPoint64,
        last_interest_timestamp: u64,
        global_interest_index: FixedPoint64,
    }

    struct FlashLoanPosition {
        py_state_address: address,
        amount: u64,
    }

    #[event]
    struct RedeemTokenEvent has store, drop {
        base_asset_type_name: String,
        redeem_asset_type_name: String,
        amount: u64,
    }

    #[event]
    struct BurnTokenEvent has store, drop {
        base_asset_type_name: String,
        burn_asset_type_name: String,
        amount: u64,
    }

    fun init_module(publisher: &signer) {
        let store = PyStore {
            all_py_states: smart_vector::empty<address>()
        };
        move_to(&get_signer(), store);
    }


    // 创建一个新的 py_state
    public(package) fun create_py(
        _expiry: u64,
        sy_type_name: String,
        sy_metadata_address: Object<Metadata>
    ) acquires PyStore {
        let py_store = borrow_global_mut<PyStore>(get_resource_address());
        // 检查传入的 py_state 是否已经存在
        //assert!(py_exists(py_store, _expiry, sy_type_name), error::already_exists(ERR_PY_STATE_ALREADY_EXITS));

        let py_state_signer = cal_py_state_address(sy_type_name, _expiry);
        // 创建新的 py_state
        let py_state = PyState {
            expiry: _expiry,
            name: sy_type_name,
            pt_supply: 0,
            yt_supply: 0,
            sy_balance: create_store(&object::create_object(signer::address_of(&py_state_signer)), sy_metadata_address),
            first_py_index: fixed_point64::zero(),
            py_index_last_updated_timestamp: 0,
            py_index_stored: fixed_point64::zero(),
            last_collect_interest_index: fixed_point64::zero(),
            total_sy_interest_for_treasury: fixed_point64::zero(),
            last_interest_timestamp: 0,
            global_interest_index: fixed_point64::zero(),
        };
        move_to(&py_state_signer, py_state);
        // 将新创建的 py_state 添加到 py_store 中
        py_store.all_py_states.push_back(signer::address_of(&py_state_signer));
    }

    // 为用户创建一个新的个人头寸
    public entry fun init_py_position(
        user: &signer,
        sy_type_name: String,
        py_state_object: Object<PyState>
    ) acquires PyState {
        let py_state = borrow_global<PyState>(object::object_address(&py_state_object));
        // 调用 py_position 模块的 open_position 函数
        py_position::open_position(
            &object::create_object(signer::address_of(user)),
            signer::address_of(user),
            object::object_address(&py_state_object),
            sy_type_name,
            py_state.expiry
        );
    }

    public(package) fun mint_py(
        yt_amount_to_mint: u64,
        pt_amount_to_mint: u64,
        py_state_object: Object<PyState>,
        user_position: Object<PyPosition>
    ) acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        py_state.pt_supply += pt_amount_to_mint;
        py_state.yt_supply += yt_amount_to_mint;

        py_position::set_pt_balance(
            user_position,
            py_position::pt_balance(user_position) + pt_amount_to_mint
        );
        py_position::set_yt_balance(
            user_position,
            py_position::yt_balance(user_position) + yt_amount_to_mint
        );
    }

    public(package) fun burn_py(
        pt_amount_to_mint: u64,
        yt_amount_to_mint: u64,
        py_state_object: Object<PyState>,
        user_position: Object<PyPosition>
    ) acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        assert!(py_position::pt_balance(user_position) >= pt_amount_to_mint && py_state.pt_supply >= pt_amount_to_mint, error::invalid_argument(ERR_INVALID_PY_AMOUNT));
        assert!(py_position::yt_balance(user_position) >= yt_amount_to_mint && py_state.pt_supply >= yt_amount_to_mint, error::invalid_argument(ERR_INVALID_PY_AMOUNT));
        py_state.pt_supply -= pt_amount_to_mint;
        py_state.yt_supply -= yt_amount_to_mint;
        py_position::set_pt_balance(
            user_position,
            py_position::pt_balance(user_position) - pt_amount_to_mint
        );
        py_position::set_yt_balance(
            user_position,
            py_position::yt_balance(user_position) - yt_amount_to_mint
        );
    }

    public(package) fun redeem_due_interest(
        py_state_object: Object<PyState>,
        user_position: Object<PyPosition>
    ) :FungibleAsset acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        let accrued_amount = py_position::accured(user_position);
        py_position::set_accured(user_position, fixed_point64::zero());
        let sy_to_withdraw = fixed_point64::decode_round_down(accrued_amount);
        // 从 PyState 的总 sy_balance 中分离出相应数量的余额
        fungible_asset::withdraw(
            &get_signer(),
            py_state.sy_balance,
            sy_to_withdraw
        )
    }

    /// 用户在市场到期后，将 PT 代币销毁以换取对应的 SY 代币
    public entry fun burn_pt(
        user: &signer,
        amount: u64,
        pt_metadata_address: Object<Metadata>,
        py_state_object: Object<PyState>,
        user_position: Object<PyPosition>,
        sy_type_name: String,
        pt_type_name: String
    ) acquires PyState {
        // 检查传入的 amount 值是否大于 0
        assert!(amount > 0, error::invalid_argument(3));
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        // 根据被 burn 的 pt 的数量调整用户的 position 中的信息
        py_position::set_pt_balance(
            user_position,
            py_position::pt_balance(user_position) + amount
        );
        let user_pt_balance = primary_fungible_store::withdraw(user, pt_metadata_address, amount);
        burn_token(
            amount,
            user_pt_balance,
            user_position,
            sy_type_name,
            pt_type_name,
            py_state
        );
    }

    fun burn_token(
        amount: u64,
        user_pt_balance: FungibleAsset,
        user_position: Object<PyPosition>,
        base_asset_type_name: String,
        burn_asset_type_name: String,
        _py_state: &PyState
    ) {
        // 发布销毁 token 的事件
        event::emit(BurnTokenEvent{
            base_asset_type_name,
            burn_asset_type_name,
            amount
        });
        // 正式进行销毁
        token_registry::burn_with_expiry(
            amount,
            user_pt_balance,
            py_position::expiry(user_position),
            base_asset_type_name,
            burn_asset_type_name
        );
    }

    /// 将用户 PyPosition (仓位对象) 中记录的 PT 余额，转换为一个可自由交易的、FungibleAsset 标准的 PT 对象
    public entry fun redeem_pt(
        user: &signer,
        user_position: Object<PyPosition>,
        py_state_object: Object<PyState>,
        sy_type_name: String,
        pt_type_name: String
    ) {
        assert!(py_position::pt_balance(user_position) > 0, error::invalid_argument(ERR_INVALID_PY_AMOUNT));
        let pt_to_redeem = py_position::pt_balance(user_position);
        py_position::set_pt_balance(
            user_position,
            0
        );
        let pt_asset = redeem_token(
            pt_to_redeem,
            py_state_object,
            user_position,
            sy_type_name,
            pt_type_name
        );
        primary_fungible_store::deposit(signer::address_of(user), pt_asset);
    }

    fun redeem_token(
        amount: u64,
        py_state_object: Object<PyState>,
        user_position: Object<PyPosition>,
        base_asset_type_name: String,
        redeem_asset_type_name: String
    ) :FungibleAsset {
        // 检查传入的 PyState 是否与当前用户的 Position 所匹配
        assert!(object::object_address(&py_state_object) == py_position::py_state_id(user_position), error::invalid_state(4));
        // 检查 PyState 是否已经到期
        assert!(py_position::expiry(user_position) > utils::now_milliseconds(), error::invalid_argument(5));
        // 发布赎回事件
        event::emit(RedeemTokenEvent{
            base_asset_type_name,
            redeem_asset_type_name,
            amount
        });
        // 为用户铸造相应数量的基础代币
        token_registry::mint_with_expiry(
            amount,
            py_position::expiry(user_position),
            base_asset_type_name,
            redeem_asset_type_name
        )
    }

    public(package) fun borrow_pt_amount(
        user_position: Object<PyPosition>,
        borrow_amount: u64,
        py_state: Object<PyState>
    ) :(u64, FlashLoanPosition) acquires PyState {
        mint_py(
            0,
            borrow_amount,
            py_state,
            user_position
        );
        // 创建闪电贷头寸记录
        let flash_loan_pos = FlashLoanPosition {
            py_state_address: object::object_address(&py_state),
            amount: borrow_amount
        };
        (borrow_amount, flash_loan_pos)
    }

    public(package) fun repay_pt_amount(
        user_position: Object<PyPosition>,
        py_state: Object<PyState>,
        flash_loan_position: FlashLoanPosition,
    ) : u64 acquires PyState {
        // 确保偿还的头寸是针对当前正确的 PyState
        assert!(object::object_address(&py_state) == flash_loan_position.py_state_address, error::invalid_argument(33));
        // 核心操作：销毁 PY(减少用户的PT余额和全局供应量，即销毁债务)
        burn_py(
            flash_loan_position.amount,
            0,
            py_state,
            user_position
        );
        // 解构FlashLoanPosition，取出amount并返回，同时丢弃该结构体（因为债务已清偿）
        let FlashLoanPosition {
            py_state_address : _,
            amount      : repaid_amount,
        } = flash_loan_position;

        repaid_amount
    }

    public(package) fun join_sy(
        py_state_object: Object<PyState>,
        sy_balance: FungibleAsset
    ) acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        fungible_asset::deposit(py_state.sy_balance, sy_balance);
    }

    public(package) fun split_sy(
        amount: u64,
        py_state_object: Object<PyState>
    ) :FungibleAsset acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        fungible_asset::withdraw(&get_signer(), py_state.sy_balance, amount)
    }

    public(package) fun join_pt(
        amount: u64,
        user_position: Object<PyPosition>,
    ) {
        py_position::set_pt_balance(
            user_position,
            py_position::pt_balance(user_position) + amount
        );
    }

    public(package) fun split_pt(
        amount: u64,
        user_position: Object<PyPosition>,
    ) :u64 {
        // 检查该用户的仓位中是否有足够的余额进行 split 操作
        assert!(py_position::pt_balance(user_position) >= amount, error::invalid_argument(ERR_INVALID_PY_AMOUNT));
        // 计算新余额并调用 py_position 模块更新
        let new_balance = py_position::pt_balance(user_position) - amount;
        py_position::set_pt_balance(user_position, new_balance);
        // 3. 返回被分离出去的数量
        amount
    }

    public(package) fun join_yt(
        amount: u64,
        user_position: Object<PyPosition>,
    ) {
        py_position::set_yt_balance(
            user_position,
            py_position::yt_balance(user_position) + amount
        );
    }

    public(package) fun split_yt(
        amount: u64,
        user_position: Object<PyPosition>,
    ) :u64 {
        // 检查该用户的仓位中是否有足够的余额进行 split 操作
        assert!(py_position::yt_balance(user_position) >= amount, error::invalid_argument(ERR_INVALID_PY_AMOUNT));
        // 计算新余额并调用 py_position 模块更新
        let new_balance = py_position::yt_balance(user_position) - amount;
        py_position::set_yt_balance(user_position, new_balance);
        // 3. 返回被分离出去的数量
        amount
    }


    /// 在市场到期后调用，用于触发最后一次利息计算，并将最终的 PY 指数存入 first_py_index 字段，从而“锁定”市场的最终结算状态
    public(package) fun set_post_expiry_data(
        treasury_fee_rate: FixedPoint64,
        sy_index_from_oracle: FixedPoint64,
        py_state_object: Object<PyState>
    ) : FixedPoint64 acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        // 1. 检查 first_py_index 是否已经被设置过。如果非零，说明已经锁定，直接返回 0
        if (!fixed_point64::is_zero(&py_state.first_py_index)) {
            return fixed_point64::zero()
        };
        // 2. 调用 update_interest_index，执行市场到期后的最后一次利息计算和分配
        let (_, _, treasury_interest_this_round) = update_interest_index(treasury_fee_rate, sy_index_from_oracle, py_state);
        // 3. 获取最后一次更新后的 PY 指数
        let final_py_index = current_py_index_internal(py_state, sy_index_from_oracle);
        // 4. 将这个最终指数写入 first_py_index 字段，从而“锁定”市场的结算状态
        py_state.first_py_index = final_py_index;
        // 5. 返回本次产生的财库利息
        treasury_interest_this_round
    }

    public(package) fun current_py_index(
        py_state_object: Object<PyState>,
        current_sy_index: FixedPoint64,
    ) :FixedPoint64 acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        let latest_py_index = *fixed_point64::max(&current_sy_index, &py_state.py_index_stored);
        // 更新状态
        py_state.py_index_stored = latest_py_index;
        py_state.py_index_last_updated_timestamp = utils::now_milliseconds();
        latest_py_index
    }

    fun current_py_index_internal(
        py_state: &mut PyState,
        current_sy_index: FixedPoint64,
    ) :FixedPoint64 {
        let latest_py_index = *fixed_point64::max(&current_sy_index, &py_state.py_index_stored);
        // 更新状态
        py_state.py_index_stored = latest_py_index;
        py_state.py_index_last_updated_timestamp = utils::now_milliseconds();
        latest_py_index
    }

    #[view]
    public fun expiry(py_state_object: Object<PyState>) :u64 acquires PyState {
        let py_state = borrow_global<PyState>(object::object_address(&py_state_object));
        py_state.expiry
    }

    #[view]
    public fun first_py_index(py_state_object: Object<PyState>) :FixedPoint64 acquires PyState {
        let py_state = borrow_global<PyState>(object::object_address(&py_state_object));
        py_state.first_py_index
    }

    #[view]
    public fun sy_metadata_address(py_state_object: Object<PyState>) :Object<Metadata> acquires PyState {
        let py_state = borrow_global<PyState>(object::object_address(&py_state_object));
        store_metadata(py_state.sy_balance)
    }

    #[view]
    public fun get_py_index(
        py_state_object: Object<PyState>,
    ) :(FixedPoint64, u64, FixedPoint64, FixedPoint64, FixedPoint64, u64, FixedPoint64) acquires PyState {
        let py_state = borrow_global<PyState>(object::object_address(&py_state_object));
        (
            py_state.py_index_stored,
            py_state.py_index_last_updated_timestamp,
            py_state.first_py_index,
            py_state.last_collect_interest_index,
            py_state.total_sy_interest_for_treasury,
            py_state.last_interest_timestamp,
            py_state.global_interest_index
        )
    }

    public fun get_sy_amount_in_for_exact_py_out(
        py_amount_out: u64,
        current_index_from_oracle: FixedPoint64,
        py_state_object: Object<PyState>,
    ) :u64 acquires PyState {
        fixed_point64::decode_round_up(
            sy::asset_to_sy(
                current_py_index(py_state_object, current_index_from_oracle),
                fixed_point64::encode(py_amount_out)
            )
        )
    }

    /**
     * @notice 计算在一段时间内产生的利息。
     * @param principal_amount: 本金数量 (这里是 YT 的总供应量)。
     * @param start_index: 起始利率指数。
     * @param end_index: 结束利率指数。
     * @return 计算出的利息总量。
    */
    fun calc_interest(
        principal_amount: FixedPoint64,
        start_index: FixedPoint64,
        end_index: FixedPoint64
    ) :FixedPoint64 {
        // interest = principal * (end_index - start_index) / (start_index * end_index)
        fixed_point64::div_fp(
            fixed_point64::mul_fp(principal_amount,
                fixed_point64::sub_fp(end_index, start_index)),
            fixed_point64::mul_fp(start_index, end_index)
        )
    }

    public(package) fun collect_interest(
        treasury_fee_rate: FixedPoint64,
        current_sy_index: FixedPoint64,
        py_state: &mut PyState,
    ) :(FixedPoint64, FixedPoint64, FixedPoint64) {
        let last_index = py_state.last_collect_interest_index;
        let current_index = current_py_index_internal(py_state, current_sy_index);
        // 分别声明代表用户和国库利息的两个变量
        let user_interest = fixed_point64::zero();
        let treasury_interest= fixed_point64::zero();
        // 如果 last_index 不为零且指数有变化，则计算利息
        if(!fixed_point64::is_zero(&last_index) && !fixed_point64::eq(&last_index, &current_index)) {
            let fee_rate_multiplier = fixed_point64::zero();
            // 如果市场尚未到期(利息仍在分配中), 则应用财库费用
            if (is_distributing_interest(py_state)) {
                fee_rate_multiplier = treasury_fee_rate;
            };
            // 计算总利息
            let total_interest = calc_interest(fixed_point64::encode(py_state.yt_supply), last_index, current_index);
            // 计算国库应得的利息
            let calculate_treasury_interest = fixed_point64::mul_fp(total_interest, fee_rate_multiplier);
            // 计算用户应得的利息
            user_interest = fixed_point64::sub_fp(total_interest, calculate_treasury_interest);
            treasury_interest = calculate_treasury_interest;
        };
        // 更新上次收集利息的指数
        py_state.last_collect_interest_index = current_index;

        (user_interest, current_index, treasury_interest)
    }

    public(package) fun update_interest_index(
        treasury_fee_rate: FixedPoint64,
        sy_index_from_oracle: FixedPoint64,
        py_state: &mut PyState,
    ) : (FixedPoint64, FixedPoint64, FixedPoint64) {
        // 1. 更新上次更新利息的时间戳
        py_state.last_interest_timestamp = utils::now_milliseconds();
        let yt_supply_before_update = py_state.yt_supply;
        // 2. 调用 collect_interest 来计算和分配利息
        let (user_interest, current_py_index, treasury_interest) = collect_interest(
            treasury_fee_rate,
            sy_index_from_oracle,
            py_state
        );
        // 3. 更新全局利息指数
        let old_global_interest_index = py_state.global_interest_index;
        let new_global_interest_index = old_global_interest_index;
        // 如果 YT 的供应量不为0，则按比例增加全局指数
        if (yt_supply_before_update != 0) {
            new_global_interest_index = fixed_point64::add_fp(
                new_global_interest_index,
                fixed_point64::div_fp(user_interest, fixed_point64::encode(yt_supply_before_update))
            );
        };
        // 4. 将更新后的指数保存回 PyState
        py_state.global_interest_index = new_global_interest_index;
        // 5. 返回 (新的全局利息指数, 当前的PY指数, 本次产生的财库利息)
        (new_global_interest_index, current_py_index, treasury_interest)
    }

    public(package) fun update_user_interest(
        treasury_fee_rate: FixedPoint64,
        sy_index_from_oracle: FixedPoint64,
        user_position: Object<PyPosition>,
        py_state_object: Object<PyState>
    ) :FixedPoint64 acquires PyState {
        let py_state = borrow_global_mut<PyState>(object::object_address(&py_state_object));
        // 1. 首先，调用 update_interest_index 来确保市场状态是全局最新的
        let (new_global_index, new_py_index, treasury_interest_this_round) = update_interest_index(
            treasury_fee_rate,
            sy_index_from_oracle,
            py_state
        );
        // 2. 获取用户上次更新时记录的个人指数
        let user_last_index = py_position::index(user_position);
        // 3. 如果用户的指数已经和全局最新指数相同，则无事发生
        if (fixed_point64::eq(&user_last_index, &new_global_index)) {
            return treasury_interest_this_round
        };
        // 4. 如果用户的指数是 0 (表示是新仓位)，则只需将用户的指数快照更新为最新值
        if (fixed_point64::is_zero(&user_last_index)) {
            py_position::set_index(user_position, new_global_index);
            py_position::set_py_index(user_position, new_py_index);
            return treasury_interest_this_round
        };
        // 5. 核心逻辑：计算用户应得的利息
        //user_new_interest = yt_balance * (new_global_index - user_last_index)
        let user_new_interest = fixed_point64::mul_fp(
            fixed_point64::encode(py_position::yt_balance(user_position)),
            fixed_point64::sub_fp(new_global_index, user_last_index)
        );
        // 6. 将新计算出的利息累加到用户的 `accured` 字段
        py_position::set_accured(user_position, fixed_point64::add_fp(
            py_position::accured(user_position),
            user_new_interest
        ));
        // 7. 更新用户的个人指数快照为最新值
        py_position::set_index(user_position, new_global_index);
        py_position::set_py_index(user_position, new_py_index);

        treasury_interest_this_round
    }


    public(package) fun is_distributing_interest(py_state: &PyState) :bool {
        fixed_point64::is_zero(&py_state.first_py_index)
    }

    // public fun py_exists(
    //     py_store: &PyStore,
    //     expiry: u64,
    //     sy_type_name: String
    // ) :bool {
    //     py_store.py.contains(get_py_id(sy_type_name, expiry))
    // }

    // 生成的唯一字符串(原始值为sy_name + 到期时间的拼接)
    // public fun get_py_id(
    //     sy_type_name: String,
    //     expiry: u64
    // ) :String {
    //     let sy_name_vector = *sy_type_name.bytes();
    //     (sy_name_vector).append(bcs::to_bytes(&expiry));
    //     utils::vector_to_hex_string(hash::sha2_256(sy_name_vector))
    // }

    fun cal_py_state_address (
        sy_type_name: String,
        expiry: u64
    ) :signer {
        let resource_signer = package_manager::get_signer();
        let py_state_constructor_ref = object::create_named_object(&resource_signer, get_py_state_seeds(sy_type_name, expiry));
        object::generate_signer(&py_state_constructor_ref)
    }

    public fun get_py_state_seeds(
        sy_type_name: String,
        expiry: u64
    ) :vector<u8> {
        let seeds_vector = *sy_type_name.bytes();
        (seeds_vector).append(bcs::to_bytes(&expiry));
        seeds_vector
    }

    #[view]
    public fun get_all_py_states(): vector<address> acquires PyStore {
        let py_store = borrow_global<PyStore>(get_resource_address());
        py_store.all_py_states.to_vector()
    }

}
